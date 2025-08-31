// lib/fastsim.ts
export type Vec2 = { x: number; y: number };
export type Params = {
  WORLD_W: number; WORLD_H: number;
  MID_TTC_THRESHOLD: number; MID_SEP_TRIGGER: number;
  WALL_TTC_THRESHOLD: number; WALL_PADDING: number;
  K_GAIN: number; G_MIN: number; G_MAX: number;
  HORIZON_S: number; H_DT: number;
  OPEN_SAFE_SEP: number; OPEN_HOLD_S: number;
  OOB_RETURN_AFTER: number; OOB_RETURN_G: number; OOB_RELEASE_MARGIN: number;
  enableMidair: boolean; enableWall: boolean; enableGuardrail: boolean; enableOOBReturn: boolean;
};

type Ctrl =
  | { name: "NormalMotion" }
  | { name: "ArcTurn"; direction: 1 | -1; gLimit: number; totalAngle: number; advanced: number; source: "midair"|"wall"; exitFraction: number; }
  | { name: "ReturnToBox"; gLimit: number; desired: Vec2 };

type AC = {
  id: string; pos: Vec2; vel: Vec2; speed: number; targetSpeed: number; accel: number; decel: number;
  overrides: { midair?: Ctrl; wall?: Ctrl }; motion: Ctrl;
};

const clamp = (x:number, lo:number, hi:number)=> x<lo?lo: x>hi?hi: x;
const add = (a:Vec2,b:Vec2)=>({x:a.x+b.x,y:a.y+b.y});
const sub = (a:Vec2,b:Vec2)=>({x:a.x-b.x,y:a.y-b.y});
const mul = (a:Vec2,s:number)=>({x:a.x*s,y:a.y*s});
const len = (v:Vec2)=>Math.hypot(v.x,v.y);
const norm = (v:Vec2)=>{const L=len(v)||1e-9; return {x:v.x/L,y:v.y/L};};
const rot = (v:Vec2,ang:number)=>{const c=Math.cos(ang),s=Math.sin(ang); return {x:c*v.x-s*v.y,y:s*v.x+c*v.y};};
const rand = (seed:number)=>()=> (seed = (seed*1664525+1013904223)>>>0, (seed&0xfffffff)/0x10000000);

function newAircraft(i:number, P:Params, R:()=>number): AC {
  const id = `A${i+1}`;
  const pos = { x: R()*P.WORLD_W, y: R()*P.WORLD_H };
  const heading = R() * Math.PI * 2;
  const speed = 53.6;
  return {
    id, pos,
    vel: { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed },
    speed, targetSpeed: speed, accel: 10, decel: 10,
    overrides: {}, motion: { name: "NormalMotion" }
  };
}

function isOOB(a:AC,P:Params){const {x,y}=a.pos; return x<0||x>P.WORLD_W||y<0||y>P.WORLD_H;}
function insideMargin(a:AC,P:Params,m:number){const {x,y}=a.pos; return x>=m && x<=P.WORLD_W-m && y>=m && y<=P.WORLD_H-m;}

function desiredInboundUnit(a:AC,P:Params):Vec2{
  const tx = clamp(a.pos.x, 0, P.WORLD_W); const ty = clamp(a.pos.y, 0, P.WORLD_H);
  const d = { x: tx - a.pos.x, y: ty - a.pos.y }; const L = len(d)||1e-9; return { x: d.x/L, y: d.y/L };
}

function computeWallTTC(a:AC,P:Params){ // time to bounds under straight-line motion
  const x=a.pos.x,y=a.pos.y; const vhat=norm(a.vel); const s=a.speed;
  const c:any[]=[];
  if (vhat.x<-1e-9) c.push(-x/(vhat.x*s));
  if (vhat.x>+1e-9) c.push((P.WORLD_W-x)/(vhat.x*s));
  if (vhat.y<-1e-9) c.push(-y/(vhat.y*s));
  if (vhat.y>+1e-9) c.push((P.WORLD_H-y)/(vhat.y*s));
  const positive=c.filter(t=>t>=0); if(!positive.length) return Infinity;
  return Math.min(...positive);
}

function computeMidairTCA(a:AC,b:AC){ // t* and dmin for straight-line motion
  const r=sub(a.pos,b.pos), v=sub(a.vel,b.vel); const v2=v.x*v.x+v.y*v.y; if(v2<1e-12) return {tStar:Infinity,dMin:Infinity};
  const tStar = - (r.x*v.x + r.y*v.y) / v2; if (tStar<0) return {tStar:Infinity,dMin:Infinity};
  const rp = add(r, mul(v, tStar)); const dMin = len(rp); return {tStar,dMin};
}

function attemptMidair(a:AC, list:AC[], P:Params){
  if (!P.enableMidair) return false;
  if (a.overrides.midair?.name==="ArcTurn" && a.overrides.midair.source==="midair") return false;
  let best:{b:AC,t:number,d:number}|null=null;
  for (const b of list){ if (b.id===a.id) continue; const {tStar,dMin}=computeMidairTCA(a,b);
    if (tStar!==Infinity && tStar<=P.MID_TTC_THRESHOLD && dMin<=P.MID_SEP_TRIGGER){
      if (!best || tStar<best.t) best={b,t:tStar,d:dMin};
    }
  }
  if (!best) return false;
  // g scaling
  const r = sub(best.b.pos,a.pos), rHat=norm(r), vRel=sub(a.vel,best.b.vel);
  const vClosure = Math.max(0, vRel.x*rHat.x + vRel.y*rHat.y);
  const gNeeded = clamp(P.K_GAIN * vClosure / Math.max(best.t, 0.5), P.G_MIN, P.G_MAX);

  // simple L/R pick: turn toward higher projected separation — approximate by cross sign
  const toB=sub(best.b.pos,a.pos); const cross = a.vel.x*toB.y - a.vel.y*toB.x;
  const direction = cross >= 0 ? 1 : -1;

  a.overrides.midair = { name:"ArcTurn", direction: direction as 1|-1, gLimit:gNeeded, totalAngle:Math.PI, advanced:0, source:"midair", exitFraction:0.5 };
  return true;
}

function attemptWall(a:AC,P:Params){
  if (!P.enableWall) return false;
  if (a.overrides.wall) return false;
  const ttc=computeWallTTC(a,P); const dist=Math.min(a.pos.x,P.WORLD_W-a.pos.x,a.pos.y,P.WORLD_H-a.pos.y);
  if (ttc<P.WALL_TTC_THRESHOLD || dist<P.WALL_PADDING+5){
    const toCenter={x:P.WORLD_W*0.5-a.pos.x,y:P.WORLD_H*0.5-a.pos.y};
    const cross=a.vel.x*toCenter.y - a.vel.y*toCenter.x;
    const direction = cross>=0?1:-1;
    a.overrides.wall={ name:"ArcTurn", direction: direction as 1|-1, gLimit:3.0, totalAngle:Math.PI, advanced:0, source:"wall", exitFraction:0.5 };
    return true;
  }
  return false;
}

function updateAC(a:AC, dt:number){
  const dv=a.targetSpeed-a.speed; const accel=clamp(dv/(dt||1e-9), -a.decel, a.accel); a.speed += accel*dt;
  const active = a.overrides.midair || a.overrides.wall || a.motion;
  if (active.name==="ArcTurn"){
    const vhat=norm(a.vel); const omega=(active.gLimit*9.81)/(a.speed||1e-9);
    const dtheta=clamp(omega*dt, -Math.PI, Math.PI) * active.direction; a.vel = mul(rot(vhat,dtheta), a.speed);
    active.advanced += Math.abs(dtheta);
    const frac = active.advanced / (active.totalAngle||Math.PI);
    if (frac >= (active.exitFraction||0.5)) (active as any).done = true;
  } else if (active.name==="ReturnToBox"){
    const vhat=norm(a.vel); const omega=(active.gLimit*9.81)/(a.speed||1e-9);
    const cross = vhat.x*active.desired.y - vhat.y*active.desired.x;
    const dotp = clamp(vhat.x*active.desired.x + vhat.y*active.desired.y, -1, 1);
    const ang = Math.atan2(cross, dotp);
    const dtheta = clamp(ang, -omega*dt, omega*dt); a.vel = mul(rot(vhat,dtheta), a.speed);
  }
  a.vel = mul(norm(a.vel), a.speed); a.pos = add(a.pos, mul(a.vel, dt));
}

function nearestIntruder(a:AC, list:AC[]){ let best:AC|null=null; let bd=Infinity;
  for(const b of list){ if(b.id===a.id) continue; const d=len(sub(a.pos,b.pos)); if(d<bd){bd=d;best=b;} } return best;
}

export type FastScoreOpts = { seeds?: number; minutes?: number; n?: number; dtMax?: number; dtMin?: number; nearMiss?: number; };
export type FastScoreResult = {
  collisions: number; exposure_hours: number; lambda_per_hour: number; ten_year_risk: number;
  near_misses: number; avg_sep: number; system_frac: number;
};

export function scoreParamsFast(Pin: Partial<Params>, opts: FastScoreOpts = {}): FastScoreResult {
  // defaults aligned to your page
  const P: Params = {
    WORLD_W: 900, WORLD_H: 600, MID_TTC_THRESHOLD: 3.0, MID_SEP_TRIGGER: 60.0,
    WALL_TTC_THRESHOLD: 2.5, WALL_PADDING: 10.0,
    K_GAIN: 0.2, G_MIN: 2.0, G_MAX: 4.5, HORIZON_S: 3.0, H_DT: 0.05,
    OPEN_SAFE_SEP: 90.0, OPEN_HOLD_S: 0.5, OOB_RETURN_AFTER: 1.5, OOB_RETURN_G: 3.0, OOB_RELEASE_MARGIN: 5.0,
    enableMidair: true, enableWall: true, enableGuardrail: true, enableOOBReturn: true,
    ...Pin,
  };

  const seeds = opts.seeds ?? 64;
  const minutes = opts.minutes ?? 2; // per seed
  const n = opts.n ?? 8;             // aircraft
  const dtMax = opts.dtMax ?? 0.2;
  const dtMin = opts.dtMin ?? 0.01;
  const nearMiss = opts.nearMiss ?? 30; // meters

  let collisions = 0;
  let near_misses = 0;
  let sep_accum = 0, sep_count = 0;
  let system_time = 0, total_time = 0;

  for (let s = 0; s < seeds; s++) {
    const R = rand(s+1);
    const list: AC[] = Array.from({length:n}, (_,i)=>newAircraft(i,P,R));
    const oobTime: Record<string, number> = {};
    const openTime: Record<string, number> = {};

    const T = minutes*60;
    let t = 0;
    while (t < T) {
      // priority: midair before wall
      for (const a of list) { attemptMidair(a, list, P) || attemptWall(a, P); }

      // choose adaptive dt from event horizon
      let nextEvent = 1.0; // default 1s
      // wall TTC min
      for (const a of list) nextEvent = Math.min(nextEvent, computeWallTTC(a,P));
      // midair TCA windows where thresholds may be hit sooner
      for (let i=0;i<list.length;i++) for (let j=i+1;j<list.length;j++) {
        const {tStar,dMin}=computeMidairTCA(list[i],list[j]);
        if (tStar!==Infinity) nextEvent = Math.min(nextEvent, tStar);
      }
      // arc completion rough horizon
      for (const a of list){
        const c = a.overrides.midair || a.overrides.wall;
        if (c?.name==="ArcTurn") {
          const omega = (c.gLimit*9.81)/(a.speed||1e-9);
          const remain = Math.max(0, (c.exitFraction*(c.totalAngle||Math.PI)) - (c.advanced||0));
          const tRemain = remain / (omega||1e-9);
          nextEvent = Math.min(nextEvent, tRemain);
        }
      }
      // OOB return after threshold
      for (const a of list){
        const wasOOB = isOOB(a,P);
        oobTime[a.id] = (oobTime[a.id]||0) + (wasOOB? Math.min(dtMax,0.1): - (oobTime[a.id]||0));
        if (wasOOB && P.enableOOBReturn && (oobTime[a.id] >= P.OOB_RETURN_AFTER)) nextEvent = Math.min(nextEvent, 0.05);
      }

      const dt = clamp(0.25*nextEvent, dtMin, dtMax);

      // update + OOB steering + early-exit
      for (const a of list){
        if (P.enableOOBReturn && isOOB(a,P)) {
          const midairActive = a.overrides.midair?.name==="ArcTurn" && a.overrides.midair.source==="midair";
          if (!midairActive) {
            const already = a.overrides.wall?.name==="ReturnToBox";
            if (already) (a.overrides.wall as any).desired = desiredInboundUnit(a,P);
            else if (oobTime[a.id] >= P.OOB_RETURN_AFTER) a.overrides.wall = { name:"ReturnToBox", gLimit:P.OOB_RETURN_G, desired: desiredInboundUnit(a,P) };
          }
        }
        // early-exit for midair if opening sustained
        if (P.enableGuardrail && a.overrides.midair?.name==="ArcTurn" && a.overrides.midair.source==="midair"){
          const intr = nearestIntruder(a, list);
          if (intr){
            const r = sub(intr.pos,a.pos), rHat=norm(r), vRel=sub(a.vel,intr.vel);
            const rDot = vRel.x*rHat.x + vRel.y*rHat.y;
            openTime[a.id] = rDot>0 ? (openTime[a.id]||0)+dt : 0;
            const sep = len(sub(intr.pos,a.pos));
            if (sep>P.OPEN_SAFE_SEP && (openTime[a.id]||0)>=P.OPEN_HOLD_S) (a.overrides.midair as any).done=true;
          }
        }
        updateAC(a, dt);

        // release RTB when inside
        if (a.overrides.wall?.name==="ReturnToBox" && insideMargin(a,P,P.OOB_RELEASE_MARGIN)){
          a.overrides.wall = undefined; a.motion={name:"NormalMotion"};
        }
      }

      // cleanup + retrigger
      for (const a of list){
        for (const key of ["midair","wall"] as const){
          const c = a.overrides[key];
          if (c?.name==="ArcTurn" && (c as any).done){
            a.overrides[key]=undefined; a.motion={name:"NormalMotion"};
            if (key==="midair"){
              const intr=nearestIntruder(a,list);
              if (intr){
                const r=sub(intr.pos,a.pos), rHat=norm(r), vRel=sub(a.vel,intr.vel);
                if ((vRel.x*rHat.x+vRel.y*rHat.y)<0 && len(sub(intr.pos,a.pos))<P.OPEN_SAFE_SEP) attemptMidair(a,list,P);
              }
            }
          }
        }
      }

      // metrics
      // collisions: any pair < 20m
      for (let i=0;i<list.length;i++) for (let j=i+1;j<list.length;j++){
        const d = len(sub(list[i].pos,list[j].pos));
        if (d<20) collisions++; else if (d<nearMiss) near_misses++;
        sep_accum += d; sep_count++;
      }
      // duty: any non-Normal controller counts as system time
      const sysNow = list.filter(a=> (a.overrides.midair && a.overrides.midair.name!=="NormalMotion") || (a.overrides.wall && a.overrides.wall.name!=="NormalMotion")).length;
      system_time += sysNow * dt; total_time += list.length * dt;

      t += dt;
    }
  }

  const exposure_hours = (seeds * (minutes/60)); // park-hours (any collision in park counts)
  const lambda_per_hour = collisions / Math.max(exposure_hours, 1e-9);
  const TEN_YEARS_H = 10*365*24;
  const ten_year_risk = 1 - Math.exp(-lambda_per_hour * TEN_YEARS_H);
  const system_frac = total_time>0 ? system_time/total_time : 0;
  const avg_sep = sep_count>0 ? sep_accum/sep_count : 0;

  return { collisions, exposure_hours, lambda_per_hour, ten_year_risk, near_misses, avg_sep, system_frac };
}
