/** Fail closed until the authenticated learner's *current* page is hydrated. */
export type PrivateMushafReadiness=Readonly<{
 enabled:boolean;learnerId:string;activePage:number;
 indexLearnerId:string|null;
 pageHydration:Readonly<{learnerId:string;page:number}>|null;
 failed:boolean;
}>;
export function mayEditPrivateMushafPage(state:PrivateMushafReadiness,targetPage:number):boolean{
 if(!state.enabled)return true; // The standalone demo is intentionally local-only.
 const loaded=state.pageHydration;
 return !state.failed&&state.indexLearnerId===state.learnerId&&
  loaded!==null&&loaded.learnerId===state.learnerId&&
  loaded.page===state.activePage&&targetPage===state.activePage;
}
