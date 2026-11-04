/** In-tab, memory-only fence for uncertain staff academy writes (#315).
 * Never use localStorage/sessionStorage: payloads can contain child IDs and
 * private manual-settlement notes. A full page reload still requires server
 * receipt reconciliation and is deliberately NOT treated as safe recovery.
 */
export type AcademyPendingCommand={
 actorId:string;
 path:string;
 payload:unknown;
};

export function createAcademyPendingStore(){
 let held:AcademyPendingCommand|null=null;
 return {
  /** Discard sensitive old-actor data on a signed account switch. */
  forActor(actorId:string):AcademyPendingCommand|null{
   if(held&&held.actorId!==actorId)held=null;
   return held;
  },
  /** Never overwrite an unresolved operation with a different command. */
  hold(command:AcademyPendingCommand):boolean{
   if(held&&held!==command)return false;
   held=command;
   return true;
  },
  /** A late old request must not clear a newer actor's operation. */
  clearIfSame(command:AcademyPendingCommand):void{
   if(held===command)held=null;
  },
 };
}

/** Shared by remounts in this browser JS runtime, not by reloads or tabs. */
export const academyPendingStore=createAcademyPendingStore();
