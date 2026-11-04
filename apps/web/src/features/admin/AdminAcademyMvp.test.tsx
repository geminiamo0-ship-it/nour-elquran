import {describe,expect,it} from 'vitest';
import {academyAdminOutcomeIsUncertain} from './AdminAcademyMvp';

describe('admin academy manual settlement retry semantics #315',()=>{
 it('preserves the original operation for ambiguous D1/proxy HTTP outcomes',()=>{
  for(const status of [408,425,429,500,502,503,504,599])
   expect(academyAdminOutcomeIsUncertain(status)).toBe(true);
 });
 it('does not turn a proven validation/permission conflict into a retry',()=>{
  for(const status of [400,401,403,404,409,422])
   expect(academyAdminOutcomeIsUncertain(status)).toBe(false);
 });
});
