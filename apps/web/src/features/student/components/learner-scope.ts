/** Render-time learner boundary: React effects clean up *after* a prop switch.
 * Never display an earlier sibling's signed data during that interim render.
 */
export type LearnerScoped<T>=Readonly<{
 learnerId:string;
 status:'loading'|'ready'|'error';
 rows:readonly T[];
}>;
export function currentLearnerRead<T>(read:LearnerScoped<T>,
 selectedLearnerId:string):LearnerScoped<T>{
 return read.learnerId===selectedLearnerId?read:{
  learnerId:selectedLearnerId,status:'loading',rows:[]
 };
}
