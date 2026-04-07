import type { TagDef } from './expert-view-types';

/** Specific core curricula — English Language Arts (HMH Into Reading through EL ELA). */
export const CORE_CURRICULA_ELA_TAGS: TagDef[] = [
  { id: 'tools-core-ela-hmh-into-reading', label: 'HMH Into Reading' },
  { id: 'tools-core-ela-mcgraw-hill-wonders', label: 'McGraw Hill Wonders' },
  { id: 'tools-core-ela-amplify-ckla', label: 'Amplify CKLA' },
  { id: 'tools-core-ela-benchmark-advance', label: 'Benchmark Advance' },
  { id: 'tools-core-ela-studysync', label: 'StudySync' },
  { id: 'tools-core-ela-wit-wisdom', label: 'Wit & Wisdom' },
  { id: 'tools-core-ela-el-ela', label: 'EL ELA' },
];

/** Specific core curricula — Mathematics (remaining core programs). */
export const CORE_CURRICULA_MATH_TAGS: TagDef[] = [
  { id: 'tools-core-math-eureka-math', label: 'Eureka Math' },
  { id: 'tools-core-math-illustrative-mathematics', label: 'Illustrative Mathematics' },
  { id: 'tools-core-math-envision-mathematics', label: 'enVision Mathematics' },
  { id: 'tools-core-math-hmh-into-math', label: 'HMH Into Math' },
  { id: 'tools-core-math-reveal-math', label: 'Reveal Math' },
];

/** Supplemental — English Language Arts (Newsela through CommonLit). */
export const SUPPLEMENTAL_ELA_TAGS: TagDef[] = [
  { id: 'tools-supp-ela-newsela', label: 'Newsela' },
  { id: 'tools-supp-ela-lexia', label: 'Lexia' },
  { id: 'tools-supp-ela-achieve3000', label: 'Achieve3000' },
  { id: 'tools-supp-ela-commonlit', label: 'CommonLit' },
];

/** Supplemental — Mathematics (ST Math through Khan Academy). */
export const SUPPLEMENTAL_MATH_TAGS: TagDef[] = [
  { id: 'tools-supp-math-st-math', label: 'ST Math' },
  { id: 'tools-supp-math-zearn', label: 'Zearn' },
  { id: 'tools-supp-math-dreambox', label: 'DreamBox' },
  { id: 'tools-supp-math-ixl', label: 'IXL' },
  { id: 'tools-supp-math-khan-academy', label: 'Khan Academy' },
];
