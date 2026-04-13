/** Blueprint ring component audience (defaults to learner when unset — legacy rings). */
export function ringExperienceAudience(component: any): "learner" | "adult" {
  return (component?.designedExperienceData?.experienceAudience === "adult" ? "adult" : "learner");
}

export function isAdultRingComponent(component: any): boolean {
  return ringExperienceAudience(component) === "adult";
}

export function isLearnerRingComponent(component: any): boolean {
  return ringExperienceAudience(component) === "learner";
}
