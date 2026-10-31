/** Page ranges are trusted only from signed published assignment anchors.
 * Prevent the embedded training viewer from escaping the assigned pages.
 */
export function validTrainingPages(startPage:number,endPage:number):boolean{
 return Number.isSafeInteger(startPage)&&Number.isSafeInteger(endPage)&&
  startPage>=1&&endPage>=startPage&&endPage<=604;
}
export function moveTrainingPage(startPage:number,endPage:number,
 currentPage:number,direction:-1|1):number{
 if(!validTrainingPages(startPage,endPage)||
  !Number.isSafeInteger(currentPage)||currentPage<startPage||currentPage>endPage||
  (direction!==-1&&direction!==1))throw Error('INVALID_TRAINING_PAGE');
 return Math.max(startPage,Math.min(endPage,currentPage+direction));
}
