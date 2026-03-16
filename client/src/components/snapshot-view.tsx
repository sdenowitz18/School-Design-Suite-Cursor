import React, { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ChevronDown, 
  ChevronRight,
  Info, 
  Plus, 
  Trash2,
  Calendar,
  Users,
  Clock,
  BookOpen,
  Layout,
  Target,
  X,
  Check,
  MoreHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { componentQueries, useUpdateComponent } from "@/lib/api";

type LegacyComponentType = "STEM" | "Humanities" | "Wayfinding" | "Well-being" | "Cross-cutting";
type LevelType = "Course" | "Subject" | "Other";

interface KeyExperience {
  id: string;
  name: string;
  formatOfTimeUse: string;
  specificType: string;
  frequency: string;
  frequencyPer: string;
  duration: string;
  timeDescription: string;
}

let keIdCounter = 0;
const generateKeId = () => `ke_${Date.now()}_${++keIdCounter}`;

const Section = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("space-y-4 pt-6 first:pt-0", className)}>
    <h3 className="text-base font-semibold text-gray-900 border-b pb-2 flex items-center justify-between">
      {title}
    </h3>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

const FieldGroup = ({ label, helper, children, required, className }: { label: string; helper?: string; children: React.ReactNode; required?: boolean; className?: string }) => (
  <div className={cn("space-y-1.5", className)}>
    <div className="flex items-center justify-between">
      <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
    </div>
    {children}
    {helper && <p className="text-xs text-gray-400">{helper}</p>}
  </div>
);

const CompactChip = ({ label, onRemove }: { label: string; onRemove?: () => void }) => (
  <Badge variant="secondary" className="font-normal text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent">
    {label}
    {onRemove && <X className="w-3 h-3 ml-1 text-gray-400 cursor-pointer hover:text-gray-600" onClick={onRemove} />}
  </Badge>
);

const OUTCOME_SCHEMA = {
  "STEM": {
    "Mathematics": ["Algebra", "Geometry", "Calculus"],
    "Natural sciences": ["Physics", "Chemistry", "Biology"],
    "Digital & AI literacies": ["Computer science", "AI literacy", "Robotics"]
  },
  "Humanities": {
    "English language arts": ["Reading", "Writing", "Literature"],
    "Social studies & civics": ["US history", "World history", "Civics"],
    "World languages": ["Mandarin", "French"],
    "Performing & visual arts": ["Visual art", "Music", "Drama"]
  },
  "Cross-cutting": {
    "Higher-order thinking skills": ["Critical thinking", "Systems thinking", "Creativity"],
    "Learning strategies & habits": ["Goal-setting", "Note-taking", "Etc."],
    "Collaboration & communication skills": ["Collaboration", "Communication", "Leadership & followership"]
  },
  "Well-being": {
    "Social emotional capacities": ["Identity & purpose", "Mindsets & self-regulation", "Relationship skills"],
    "Physical capacities": ["Athletics", "Healthy habits", "Etc."],
    "Mental & physical health": ["Emotional well-being & mood", "Stress & resilience", "Anxiety/depressive symptoms"],
    "Behavior, attendance, & engagement": ["Attendance", "Positive & negative behavioral incidents", "Participation"]
  },
  "Wayfinding": {
    "Practical, professional, & continuing education capacities": ["Practical knowledge & life skills", "Professional knowledge & skills", "Continuing-education / post-secondary knowledge & exposure"],
    "Postsecondary assets": ["Industry-recognized credentials", "Early college coursework", "Postsecondary plan"],
    "Transitional milestones": ["Promotion / graduation", "Postsecondary enrollment", "Successful career transition"]
  }
};

const OutcomePill = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-medium" data-testid={`pill-outcome-${label}`}>
    <Target className="w-3 h-3" />
    {label}
    <X className="w-3 h-3 ml-1 opacity-50 cursor-pointer hover:opacity-100 hover:text-emerald-900" onClick={onRemove} />
  </div>
);

interface SnapshotViewProps {
  nodeId?: string;
  title?: string;
  color?: string;
}

export default function SnapshotView({ nodeId, title, color }: SnapshotViewProps) {
  const { data: componentData, isLoading } = useQuery(componentQueries.byNodeId(nodeId || ""));
  const updateMutation = useUpdateComponent();

  const [level, setLevel] = useState<LevelType>("Course");
  const [showHelper, setShowHelper] = useState(false);
  const [isAP, setIsAP] = useState(false);
  const [description, setDescription] = useState("");
  
  const [formatOfTimeUse, setFormatOfTimeUse] = useState<string>("course_core");
  const [specificType, setSpecificType] = useState<string>("");
  const [participationModel, setParticipationModel] = useState("all");

  const [subcomponents, setSubcomponents] = useState<string[]>([]);
  const [variants, setVariants] = useState<string[]>([]);
  const [studentGroups, setStudentGroups] = useState<string[]>([]);
  const [keyExperiences, setKeyExperiences] = useState<KeyExperience[]>([]);
  const [expandedExperience, setExpandedExperience] = useState<string | null>(null);
  const [primaryOutcomes, setPrimaryOutcomes] = useState<string[]>([]);
  const [embeddedComponents, setEmbeddedComponents] = useState<string[]>([]);
  const [hostCourses, setHostCourses] = useState<string[]>([]);

  const [selectionGating, setSelectionGating] = useState("universal");
  const [gatingSpecifics, setGatingSpecifics] = useState("");
  const [amountStudents, setAmountStudents] = useState("450");
  const [amountPercentage, setAmountPercentage] = useState("100");
  const [amountContext, setAmountContext] = useState("student_body");
  const [amountClassrooms, setAmountClassrooms] = useState("12");

  const [compositionType, setCompositionType] = useState("same");
  const [compFRL, setCompFRL] = useState(45);
  const [compIEP, setCompIEP] = useState(12);
  const [compELL, setCompELL] = useState(8);
  const [compFemale, setCompFemale] = useState(50);

  const [sequenceDescription, setSequenceDescription] = useState("");
  const [curriculumDescription, setCurriculumDescription] = useState("");
  const [assessmentDescription, setAssessmentDescription] = useState("");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(`openSections_${nodeId}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      subjects: true,
      time_model: true,
      sequence: true,
      levels: true,
      curriculum: true,
      selection_gating: true,
      amount_students: true,
      composition: true
    };
  });

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(`openSections_${nodeId}`, JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (componentData && componentData.snapshotData) {
      const s = componentData.snapshotData as any;
      const legacyType = s.componentType as LegacyComponentType | undefined;
      // Prefer the explicit level (new behavior). Only fall back to legacy componentType mapping
      // when no level was previously saved.
      const savedLevel = s.level as LevelType | undefined;
      if (savedLevel === "Course" || savedLevel === "Subject" || savedLevel === "Other") {
        setLevel(savedLevel);
      } else if (legacyType && legacyType !== "STEM" && legacyType !== "Humanities") {
        setLevel("Other");
      } else {
        setLevel("Course");
      }
      setIsAP(s.isAP || false);
      setDescription(s.description || "");
      setFormatOfTimeUse(s.formatOfTimeUse || "course_core");
      setSpecificType(s.specificType || "");
      setParticipationModel(s.participationModel || "all");
      setSubcomponents(s.subcomponents || []);
      setVariants(s.variants || []);
      setStudentGroups(s.studentGroups || []);
      const rawKE = s.keyExperiences || [];
      if (rawKE.length > 0 && typeof rawKE[0] === 'string') {
        setKeyExperiences(rawKE.map((name: string) => ({
          id: generateKeId(),
          name,
          formatOfTimeUse: "other",
          specificType: "",
          frequency: "",
          frequencyPer: "year",
          duration: "",
          timeDescription: "",
        })));
      } else {
        setKeyExperiences(rawKE.map((ke: any) => ({
          ...ke,
          id: ke.id || generateKeId(),
        })));
      }
      // One-way sync: Snapshot Primary Outcomes are the source of truth.
      setPrimaryOutcomes(s.primaryOutcomes || []);
      setEmbeddedComponents(s.embeddedComponents || []);
      setHostCourses(s.hostCourses || []);
      setSelectionGating(s.selectionGating || "universal");
      setGatingSpecifics(s.gatingSpecifics || "");
      setAmountStudents(s.amountStudents || "0");
      setAmountPercentage(s.amountPercentage || "0");
      setAmountContext(s.amountContext || "student_body");
      setAmountClassrooms(s.amountClassrooms || "0");
      setCompositionType(s.compositionType || "same");
      setCompFRL(s.compFRL ?? 45);
      setCompIEP(s.compIEP ?? 12);
      setCompELL(s.compELL ?? 8);
      setCompFemale(s.compFemale ?? 50);
      setSequenceDescription(s.sequenceDescription || "");
      setCurriculumDescription(s.curriculumDescription || "");
      setAssessmentDescription(s.assessmentDescription || "");
    }
  }, [componentData]);

  const normLabel = (s: string) => s.trim().toLowerCase();
  const generateAimId = () => `snap_${Math.random().toString(36).slice(2, 10)}`;

  const saveSnapshot = useCallback(() => {
    if (!nodeId) return;
    const snapshotData = {
      description,
      level,
      isAP,
      formatOfTimeUse,
      specificType,
      participationModel,
      subcomponents,
      variants,
      studentGroups,
      keyExperiences,
      primaryOutcomes,
      embeddedComponents,
      hostCourses,
      selectionGating,
      gatingSpecifics,
      amountStudents,
      amountPercentage,
      amountContext,
      amountClassrooms,
      compositionType,
      compFRL,
      compIEP,
      compELL,
      compFemale,
      sequenceDescription,
      curriculumDescription,
      assessmentDescription,
      // Preserve any previously stored value (no longer user-editable).
      componentType: (componentData as any)?.snapshotData?.componentType,
    };

    // Keep Snapshot outcomes consistent with Designed Experience outcome aims.
    const de: any = componentData?.designedExperienceData || {};
    const kde = de.keyDesignElements || { aims: [], practices: [], supports: [] };
    const aims: any[] = kde.aims || [];
    const otherAims = aims.filter((a: any) => a.type !== "outcome");
    const existingOutcomeAims = aims.filter((a: any) => a.type === "outcome");

    const desiredOutcomeLabels = Array.from(
      new Set((primaryOutcomes || []).map((x) => String(x || "").trim()).filter(Boolean)),
    );
    const desiredOutcomeKeys = new Set(desiredOutcomeLabels.map((l) => normLabel(l)));
    // One-way, additive sync:
    // - Ensure all Primary Outcomes exist as outcome aims in Designed Experience
    // - Do NOT delete outcome aims that were added in Designed Experience
    const nextOutcomeAims = existingOutcomeAims.map((a: any) => {
      const key = normLabel(String(a?.label || ""));
      const shouldBePrimary = desiredOutcomeKeys.has(key);
      return {
        ...a,
        // Only outcomes selected as Primary in Snapshot are starred in Designed Experience.
        isPrimary: shouldBePrimary ? true : undefined,
        // Ensure newly-created Snapshot-driven aims get a reasonable default priority.
        level: a?.level ?? "Medium",
      };
    });
    for (const label of desiredOutcomeLabels) {
      const exists = nextOutcomeAims.some((a: any) => normLabel(a.label) === normLabel(label));
      if (!exists) {
        nextOutcomeAims.push({ id: generateAimId(), type: "outcome", label, isPrimary: true, level: "Medium" });
      }
    }

    const designedExperienceData = {
      ...de,
      keyDesignElements: {
        ...kde,
        aims: [...otherAims, ...nextOutcomeAims],
      },
    };

    updateMutation.mutate({ nodeId, data: { snapshotData, designedExperienceData } });
  }, [nodeId, description, level, isAP, formatOfTimeUse, specificType, participationModel, subcomponents, variants, studentGroups, keyExperiences, primaryOutcomes, embeddedComponents, hostCourses, selectionGating, gatingSpecifics, amountStudents, amountPercentage, amountContext, amountClassrooms, compositionType, compFRL, compIEP, compELL, compFemale, sequenceDescription, curriculumDescription, assessmentDescription, componentData]);

  useEffect(() => {
    if (!nodeId || !componentData) return;
    const timer = setTimeout(() => {
      saveSnapshot();
    }, 1000);
    return () => clearTimeout(timer);
  }, [description, level, isAP, formatOfTimeUse, specificType, participationModel, subcomponents, variants, studentGroups, keyExperiences, primaryOutcomes, embeddedComponents, hostCourses, selectionGating, gatingSpecifics, amountStudents, amountPercentage, amountContext, amountClassrooms, compositionType, compFRL, compIEP, compELL, compFemale, sequenceDescription, curriculumDescription, assessmentDescription]);

  const SCHOOL_AVERAGES = {
     frl: 45,
     iep: 12,
     ell: 8,
     female: 50
  };

  const addItem = (list: string[], setList: (l: string[]) => void, item: string) => {
    if (item && !list.includes(item)) {
      setList([...list, item]);
    }
  };

  const removeItem = (list: string[], setList: (l: string[]) => void, itemToRemove: string) => {
    setList(list.filter(item => item !== itemToRemove));
  };

  const addPrimaryOutcome = (outcome: string) => {
    const next = String(outcome || "").trim();
    if (!next) return;
    setPrimaryOutcomes((prev) => (prev.includes(next) ? prev : [...prev, next]));
  };

  const removePrimaryOutcome = (outcome: string) => {
    const next = String(outcome || "").trim();
    if (!next) return;
    setPrimaryOutcomes((prev) => prev.filter((x) => x !== next));
  };

  const templateType = level === "Other" ? "C" : level === "Course" ? "A" : "B";

  const timeUseOptions = [
    { value: "course_core", label: "Course / Core instructional block", hasL3: true },
    { value: "course_sequence", label: "Course sequence", hasL3: true },
    { value: "course_segment", label: "Course segment", hasL3: true },
    { value: "intervention", label: "Intervention block", hasL3: false },
    { value: "extracurricular", label: "Extracurricular / after-school time", hasL3: true },
    { value: "flexible", label: "Flexible time", hasL3: true },
    { value: "special_event", label: "Special event", hasL3: false },
    { value: "other", label: "Other learning experience", hasL3: false },
    { value: "integrated", label: "Integrated into other components", hasL3: false },
  ];

  const specificTypeOptions: Record<string, string[]> = {
    "course_core": ["Core course", "Elective", "Core elementary instructional block"],
    "course_sequence": ["Pathway"],
    "course_segment": ["Activity", "Station", "Unit"],
    "extracurricular": ["Club", "Sport", "Extracurricular activity"],
    "flexible": ["Independent study", "Study hall", "Flex time"]
  };

  const getTimeModelType = (format: string) => {
    if (format === "intervention") return "free_text";
    if (format === "course_sequence") return "sequence";
    if (format === "course_core") return "core_course";
    return "standard";
  };

  const timeModelType = getTimeModelType(formatOfTimeUse);

  const AddItemControl = ({ onAdd, placeholder }: { onAdd: (val: string) => void, placeholder: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [value, setValue] = useState("");

    const handleSubmit = () => {
      if (value.trim()) {
        onAdd(value.trim());
        setValue("");
        setIsOpen(false);
      }
    };

    if (isOpen) {
      return (
        <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
          <Input 
            autoFocus
            className="h-7 w-32 text-xs" 
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') setIsOpen(false);
            }}
            onBlur={() => setIsOpen(false)} 
          />
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSubmit}>
            <Check className="w-3 h-3 text-green-600" />
          </Button>
        </div>
      );
    }

    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
        data-testid="button-add-item"
      >
        <Plus className="w-3 h-3" /> Add item
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-gray-400">Loading component data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-24 px-6 md:px-10">
      
      <div className="py-6 space-y-4">
        <div className="space-y-3">
           <div className="relative group">
              <Textarea 
                placeholder="In 1–3 sentences, what is this component and why does it exist?" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[60px] text-lg text-gray-600 border-none px-0 shadow-none focus-visible:ring-0 leading-relaxed bg-transparent -ml-1 p-1 resize-y"
                data-testid="input-description"
              />
              <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                 <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600" onClick={() => setShowHelper(!showHelper)}>
                   {showHelper ? "Hide prompts" : "Helper prompts"}
                 </Button>
              </div>
              {showHelper && (
                <div className="bg-blue-50/50 p-3 rounded-md text-xs text-blue-800 space-y-1 mt-2 border border-blue-100">
                  <p>• What should students reliably get from this?</p>
                  <p>• How does it differ from current/previous practice?</p>
                </div>
              )}
           </div>

           <div className="flex flex-wrap items-center gap-3 pt-2">
              <div className="flex bg-gray-100 rounded-full p-0.5 h-7 items-center">
                <button
                  onClick={() => setLevel("Course")}
                  className={cn(
                    "text-[10px] uppercase font-bold px-3 h-full rounded-full transition-all",
                    level === "Course" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700",
                  )}
                  data-testid="button-level-course"
                >
                  Course
                </button>
                <button
                  onClick={() => setLevel("Subject")}
                  className={cn(
                    "text-[10px] uppercase font-bold px-3 h-full rounded-full transition-all",
                    level === "Subject" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700",
                  )}
                  data-testid="button-level-subject"
                >
                  Subject
                </button>
                <button
                  onClick={() => setLevel("Other")}
                  className={cn(
                    "text-[10px] uppercase font-bold px-3 h-full rounded-full transition-all",
                    level === "Other" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700",
                  )}
                  data-testid="button-level-other"
                >
                  Other
                </button>
              </div>

              {templateType === "B" && (
                <>
                  <Separator orientation="vertical" className="h-4 hidden md:block" />
                  <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 h-7">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Enrollment:</span>
                    <button
                      onClick={() => setSelectionGating("universal")}
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full transition-all",
                        selectionGating === "universal" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      Universal
                    </button>
                    <button
                      onClick={() => setSelectionGating("elective")}
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full transition-all",
                        selectionGating === "elective" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      Elective
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 h-7">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">AP/IB:</span>
                    <Switch checked={isAP} onCheckedChange={setIsAP} id="ap-toggle-top" className="scale-75" />
                  </div>
                </>
              )}

              <Separator orientation="vertical" className="h-4 hidden md:block" />
              
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mr-1">Outcomes:</span>
                {primaryOutcomes.map(outcome => (
                  <OutcomePill 
                    key={outcome} 
                    label={outcome} 
                    onRemove={() => removePrimaryOutcome(outcome)} 
                  />
                ))}
                
                <Sheet>
                  <SheetTrigger asChild>
                     <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded-full px-2 py-0.5 hover:border-gray-400 transition-colors" data-testid="button-add-outcome">
                        <Plus className="w-3 h-3" /> Add
                     </button>
                  </SheetTrigger>
                  <SheetContent className="overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Select Outcomes</SheetTitle>
                      <SheetDescription>Choose outcomes for this component.</SheetDescription>
                    </SheetHeader>
                    <div className="mt-4 space-y-6">
                      <Input placeholder="Search outcomes..." className="mb-4" data-testid="input-search-outcomes" />
                      
                      {Object.entries(OUTCOME_SCHEMA).map(([category, subcategories]) => (
                        <div key={category} className="space-y-3">
                          <h4 className="text-sm font-bold text-gray-900 border-b pb-1">{category}</h4>
                          <div className="space-y-4 pl-2">
                             {Object.entries(subcategories).map(([subcategory, outcomes]) => (
                               <div key={subcategory} className="space-y-2">
                                  <h5 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{subcategory}</h5>
                                  <div className="grid grid-cols-1 gap-1">
                                    {(outcomes as string[]).map(outcome => {
                                      const isSelected = primaryOutcomes.includes(outcome);
                                      return (
                                        <div 
                                          key={outcome} 
                                          className={cn(
                                            "flex items-center justify-between p-2 rounded cursor-pointer border transition-colors text-xs",
                                            isSelected 
                                              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                                              : "hover:bg-gray-50 border-transparent hover:border-gray-100 text-gray-700"
                                          )}
                                          onClick={() => {
                                            if (isSelected) {
                                              removePrimaryOutcome(outcome);
                                            } else {
                                              addPrimaryOutcome(outcome);
                                            }
                                          }}
                                          data-testid={`outcome-option-${outcome}`}
                                        >
                                          <span>{outcome}</span>
                                          {isSelected ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Plus className="w-3.5 h-3.5 text-gray-300" />}
                                        </div>
                                      );
                                    })}
                                  </div>
                               </div>
                             ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
           </div>
         </div>
      </div>

      <Separator className="mb-6" />

      <div className="grid grid-cols-1 gap-6">
        
        <Section title="High-Level Structure">
           {templateType === "A" && (
            <div className="space-y-3">
              <Collapsible open={openSections.subjects} onOpenChange={() => toggleSection('subjects')}>
                <div className="border border-gray-200 shadow-sm bg-gray-50/50 rounded-lg">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors rounded-lg group">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">Subjects</span>
                        {subcomponents.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-gray-200 text-gray-600">{subcomponents.length}</Badge>
                        )}
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <div className="flex flex-wrap gap-2 pt-1">
                        {subcomponents.map(item => (
                          <div key={item} className="flex items-center gap-2 px-3 py-1.5 bg-white text-gray-800 border border-gray-200 rounded-md text-sm font-medium shadow-sm" data-testid={`chip-subcomponent-${item}`}>
                            <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                            {item}
                            <X 
                              className="w-3.5 h-3.5 ml-1 text-gray-400 cursor-pointer hover:text-red-500 transition-colors" 
                              onClick={() => removeItem(subcomponents, setSubcomponents, item)} 
                            />
                          </div>
                        ))}
                        <AddItemControl onAdd={(val) => addItem(subcomponents, setSubcomponents, val)} placeholder="Subcomponent..." />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              <Collapsible open={openSections.time_model} onOpenChange={() => toggleSection('time_model')}>
                <div className="border border-gray-200 shadow-sm bg-gray-50/50 rounded-lg">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors rounded-lg group">
                      <span className="text-sm font-semibold text-gray-700">Time Model</span>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4">
                      <div className="flex flex-wrap items-end gap-4">
                        <div className="flex bg-white rounded-md border p-0.5 h-8">
                          <button className="px-3 py-0.5 text-xs font-medium bg-gray-100 rounded text-gray-900">Daily</button>
                          <button className="px-3 py-0.5 text-xs font-medium text-gray-500 hover:text-gray-900">Block</button>
                        </div>

                        <div className="space-y-1 flex-1 min-w-[120px]">
                          <label className="text-[10px] text-gray-400 uppercase font-semibold">Term Length</label>
                          <Select defaultValue="full">
                            <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full">Full Year</SelectItem>
                              <SelectItem value="semester">Semester</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-semibold">Frequency</label>
                          <div className="flex items-center gap-2">
                            <Input className="h-8 text-xs bg-white w-12" defaultValue="5" />
                            <span className="text-[10px] text-gray-400 uppercase font-medium">times per</span>
                            <Select defaultValue="week">
                              <SelectTrigger className="h-8 text-xs bg-white flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="day">Day</SelectItem>
                                <SelectItem value="week">Week</SelectItem>
                                <SelectItem value="month">Month</SelectItem>
                                <SelectItem value="year">Year</SelectItem>
                                <SelectItem value="total">Total</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-semibold">Duration</label>
                          <div className="flex items-center gap-2">
                            <Input className="h-8 text-xs bg-white w-16" defaultValue="50" />
                            <span className="text-[10px] text-gray-400 uppercase font-medium">minutes</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              <Collapsible open={openSections.sequence} onOpenChange={() => toggleSection('sequence')}>
                <div className="border border-gray-200 shadow-sm bg-gray-50/50 rounded-lg">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors rounded-lg group">
                      <span className="text-sm font-semibold text-gray-700">Course Sequence Description</span>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <Textarea 
                        placeholder="Describe how the sequence works (e.g. Students typically take Algebra I in 9th grade, followed by Geometry...)" 
                        value={sequenceDescription}
                        onChange={(e) => setSequenceDescription(e.target.value)}
                        className="min-h-[80px] text-sm resize-none bg-white border-gray-200"
                        data-testid="input-sequence-description"
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </div>
           )}

           {templateType === "B" && (
            <div className="space-y-3">
              <Collapsible open={openSections.levels} onOpenChange={() => toggleSection('levels')}>
                <div className="border border-gray-200 shadow-sm bg-gray-50/50 rounded-lg">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors rounded-lg group">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">Subject Levels</span>
                        {variants.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-gray-200 text-gray-600">{variants.length}</Badge>
                        )}
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4">
                      <div className="flex flex-wrap gap-2 pt-1">
                        {variants.map(item => (
                          <div key={item} className="flex items-center gap-2 px-3 py-1.5 bg-white text-gray-800 border border-gray-200 rounded-md text-sm font-medium shadow-sm" data-testid={`chip-variant-${item}`}>
                            <Layout className="w-3.5 h-3.5 text-blue-500" />
                            {item}
                            <X 
                              className="w-3.5 h-3.5 ml-1 text-gray-400 cursor-pointer hover:text-red-500 transition-colors" 
                              onClick={() => removeItem(variants, setVariants, item)} 
                            />
                          </div>
                        ))}
                        <AddItemControl onAdd={(val) => addItem(variants, setVariants, val)} placeholder="Variant..." />
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              <Collapsible open={openSections.time_model} onOpenChange={() => toggleSection('time_model')}>
                <div className="border border-gray-200 shadow-sm bg-gray-50/50 rounded-lg">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors rounded-lg group">
                      <span className="text-sm font-semibold text-gray-700">Time Model</span>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4">
                      <div className="flex flex-wrap items-end gap-4">
                        <div className="flex bg-white rounded-md border p-0.5 h-8">
                          <button className="px-3 py-0.5 text-xs font-medium bg-gray-100 rounded text-gray-900">Daily</button>
                          <button className="px-3 py-0.5 text-xs font-medium text-gray-500 hover:text-gray-900">Block</button>
                        </div>

                        <div className="space-y-1 flex-1 min-w-[120px]">
                          <label className="text-[10px] text-gray-400 uppercase font-semibold">Term Length</label>
                          <Select defaultValue="full">
                            <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full">Full Year</SelectItem>
                              <SelectItem value="semester">Semester</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-semibold">Frequency</label>
                          <div className="flex items-center gap-2">
                            <Input className="h-8 text-xs bg-white w-12" defaultValue="5" />
                            <span className="text-[10px] text-gray-400 uppercase font-medium">times per</span>
                            <Select defaultValue="week">
                              <SelectTrigger className="h-8 text-xs bg-white flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="day">Day</SelectItem>
                                <SelectItem value="week">Week</SelectItem>
                                <SelectItem value="month">Month</SelectItem>
                                <SelectItem value="year">Year</SelectItem>
                                <SelectItem value="total">Total</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-400 uppercase font-semibold">Duration</label>
                          <div className="flex items-center gap-2">
                            <Input className="h-8 text-xs bg-white w-16" defaultValue="50" />
                            <span className="text-[10px] text-gray-400 uppercase font-medium">minutes</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              <Collapsible open={openSections.curriculum} onOpenChange={() => toggleSection('curriculum')}>
                <div className="border border-gray-200 shadow-sm bg-gray-50/50 rounded-lg">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors rounded-lg group">
                      <span className="text-sm font-semibold text-gray-700">Curriculum & Assessment</span>
                      <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4">
                      <FieldGroup label="Curriculum" helper="What specific curriculum is being used? (e.g. Illustrative Math, EL Education)">
                        <Textarea 
                          value={curriculumDescription}
                          onChange={(e) => setCurriculumDescription(e.target.value)}
                          className="bg-white resize-none h-20 text-sm"
                          placeholder="Describe the curriculum..."
                          data-testid="input-curriculum-description"
                        />
                      </FieldGroup>
                      <FieldGroup label="Assessment" helper="How is student progress measured? (e.g. NWEA Map, unit tests)">
                        <Textarea 
                          value={assessmentDescription}
                          onChange={(e) => setAssessmentDescription(e.target.value)}
                          className="bg-white resize-none h-20 text-sm"
                          placeholder="Describe the assessment strategy..."
                          data-testid="input-assessment-description"
                        />
                      </FieldGroup>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </div>
           )}

           {templateType === "C" && (
             <div className="space-y-6">
                <FieldGroup label="Key Experiences" helper="Each experience has its own format of time use. Click to expand for description.">
                   <div className="space-y-3 pt-1">
                      {keyExperiences.map((exp, idx) => {
                        const isExpanded = expandedExperience === exp.id;
                        return (
                          <div key={exp.id} className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden" data-testid={`card-experience-${exp.name}`}>
                             <div 
                               className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
                               onClick={() => setExpandedExperience(isExpanded ? null : exp.id)}
                             >
                                <div className="flex items-center gap-3">
                                   {isExpanded 
                                     ? <ChevronDown className="w-4 h-4 text-gray-400" /> 
                                     : <ChevronRight className="w-4 h-4 text-gray-400" />
                                   }
                                   <Target className="w-4 h-4 text-blue-500" />
                                   <span className="text-sm font-medium text-gray-800">{exp.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                   {exp.formatOfTimeUse && exp.formatOfTimeUse !== "other" && (
                                     <Badge variant="secondary" className="text-[10px]">
                                       {timeUseOptions.find(o => o.value === exp.formatOfTimeUse)?.label || exp.formatOfTimeUse}
                                     </Badge>
                                   )}
                                   <button
                                     className="p-1 rounded hover:bg-red-50 transition-colors"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       setKeyExperiences(keyExperiences.filter((_, i) => i !== idx));
                                       if (expandedExperience === exp.id) setExpandedExperience(null);
                                     }}
                                   >
                                     <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                                   </button>
                                </div>
                             </div>
                             
                             {isExpanded && (
                               <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/30 space-y-4">
                                  <FieldGroup label="Format of Time Use">
                                     <Select 
                                       value={exp.formatOfTimeUse} 
                                       onValueChange={(v) => {
                                         const updated = [...keyExperiences];
                                         updated[idx] = { ...updated[idx], formatOfTimeUse: v, specificType: "" };
                                         setKeyExperiences(updated);
                                       }}
                                     >
                                        <SelectTrigger className="w-full h-9 bg-white" data-testid={`select-format-${exp.id}`}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {timeUseOptions.map(opt => (
                                             <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                          ))}
                                        </SelectContent>
                                     </Select>
                                  </FieldGroup>

                                  <FieldGroup label="Description">
                                     <Textarea 
                                       className="min-h-[80px] text-sm bg-white resize-y" 
                                       placeholder="Describe this experience..."
                                       value={exp.timeDescription}
                                       onChange={(e) => {
                                         const updated = [...keyExperiences];
                                         updated[idx] = { ...updated[idx], timeDescription: e.target.value };
                                         setKeyExperiences(updated);
                                       }}
                                       data-testid={`input-exp-desc-${exp.id}`}
                                     />
                                  </FieldGroup>
                               </div>
                             )}
                          </div>
                        );
                      })}
                      
                      <AddItemControl 
                        onAdd={(val) => {
                          const newId = generateKeId();
                          const newExp: KeyExperience = {
                            id: newId,
                            name: val,
                            formatOfTimeUse: "other",
                            specificType: "",
                            frequency: "",
                            frequencyPer: "year",
                            duration: "",
                            timeDescription: "",
                          };
                          setKeyExperiences([...keyExperiences, newExp]);
                          setExpandedExperience(newId);
                        }} 
                        placeholder="Experience name..." 
                      />
                   </div>
                </FieldGroup>
             </div>
           )}
        </Section>

        <Section title="Who it serves & Reach">
          <div className="space-y-3">
            <Collapsible open={openSections.selection_gating} onOpenChange={() => toggleSection('selection_gating')}>
              <div className="border border-gray-200 shadow-sm bg-gray-50/50 rounded-lg">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors rounded-lg group">
                    <span className="text-sm font-semibold text-gray-700">Selection Gating</span>
                    <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-3">
                    <FieldGroup label="Selection Gating of Students">
                      <Select value={selectionGating} onValueChange={setSelectionGating}>
                        <SelectTrigger className="w-full h-9 bg-white border-gray-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="universal">Universal (for applicable grade levels)</SelectItem>
                          <SelectItem value="opt_in">Open opt-in</SelectItem>
                          <SelectItem value="prereq">Course pre-requisites</SelectItem>
                          <SelectItem value="honors">High-performance-based invitation / honors</SelectItem>
                          <SelectItem value="remediation">Low-performance-based invitation / remediation</SelectItem>
                          <SelectItem value="specific">For specific populations (ELLs, IEPs, etc.)</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldGroup>
                    
                    {["prereq", "specific", "honors", "remediation"].includes(selectionGating) && (
                      <div className="pt-1 animate-in fade-in slide-in-from-top-1">
                        <FieldGroup label={selectionGating === 'prereq' ? 'List Pre-requisites' : 'Describe Target Population/Criteria'}>
                          <Input 
                            value={gatingSpecifics} 
                            onChange={(e) => setGatingSpecifics(e.target.value)}
                            className="h-8 text-xs bg-white" 
                            placeholder={selectionGating === 'prereq' ? "e.g. Algebra I..." : "Describe criteria..."}
                          />
                        </FieldGroup>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            <Collapsible open={openSections.amount_students} onOpenChange={() => toggleSection('amount_students')}>
              <div className="border border-gray-200 shadow-sm bg-gray-50/50 rounded-lg">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors rounded-lg group">
                    <span className="text-sm font-semibold text-gray-700">Amount of Students</span>
                    <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FieldGroup label="Total Students">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <Input 
                            value={amountStudents} 
                            onChange={(e) => setAmountStudents(e.target.value)}
                            className="h-9 w-full bg-white font-medium" 
                            data-testid="input-amount-students"
                          />
                        </div>
                      </FieldGroup>
                      <FieldGroup label="Classrooms">
                        <div className="flex items-center gap-2">
                          <Layout className="w-4 h-4 text-gray-400" />
                          <Input 
                            value={amountClassrooms} 
                            onChange={(e) => setAmountClassrooms(e.target.value)}
                            className="h-9 w-full bg-white font-medium" 
                          />
                        </div>
                      </FieldGroup>
                    </div>
                    
                    <FieldGroup label="Percentage Context">
                      <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-md border border-gray-200">
                        <div className="relative w-20">
                          <Input 
                            value={amountPercentage} 
                            onChange={(e) => setAmountPercentage(e.target.value)}
                            className="h-8 text-right pr-6 bg-white border-none shadow-none focus-visible:ring-0" 
                          />
                          <span className="absolute right-2 top-1.5 text-sm text-gray-500">%</span>
                        </div>
                        <span className="text-xs text-gray-400 font-medium">OF</span>
                        <Select value={amountContext} onValueChange={setAmountContext}>
                          <SelectTrigger className="flex-1 h-8 text-xs border-none bg-transparent shadow-none focus:ring-0 px-2"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="grade_level">Grade Level</SelectItem>
                            <SelectItem value="student_body">Student Body</SelectItem>
                            <SelectItem value="relevant_classrooms">Relevant Classrooms</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </FieldGroup>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            <Collapsible open={openSections.composition} onOpenChange={() => toggleSection('composition')}>
              <div className="border border-gray-200 shadow-sm bg-gray-50/50 rounded-lg">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-4 hover:bg-gray-100/50 transition-colors rounded-lg group">
                    <span className="text-sm font-semibold text-gray-700">Composition</span>
                    <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-4">
                    <RadioGroup 
                      value={compositionType} 
                      onValueChange={(val) => {
                        setCompositionType(val);
                        if (val === 'same') {
                          setCompFRL(SCHOOL_AVERAGES.frl);
                          setCompIEP(SCHOOL_AVERAGES.iep);
                          setCompELL(SCHOOL_AVERAGES.ell);
                          setCompFemale(SCHOOL_AVERAGES.female);
                        }
                      }} 
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="same" id="comp-same" className="mt-1" />
                        <div className="grid gap-0.5">
                          <Label htmlFor="comp-same" className="font-medium text-sm text-gray-900">Roughly same</Label>
                          <p className="text-xs text-gray-500">Matches overall student body demographics</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="different" id="comp-diff" className="mt-1" />
                        <div className="grid gap-0.5">
                          <Label htmlFor="comp-diff" className="font-medium text-sm text-gray-900">Different composition</Label>
                          <p className="text-xs text-gray-500">Customize demographics below</p>
                        </div>
                      </div>
                    </RadioGroup>

                    <Separator />
                    
                    <div className={cn("space-y-4 transition-all duration-300", compositionType === "same" ? "pointer-events-none" : "")}>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600 font-medium">Gender (Female / Male)</span>
                          <span className="text-gray-900">{compFemale}% / {100-compFemale}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex relative group cursor-pointer">
                          <div className="h-full bg-pink-400 transition-all duration-300" style={{ width: `${compFemale}%` }} />
                          <div className="h-full bg-blue-400 transition-all duration-300 flex-1" />
                          {compositionType === 'different' && (
                            <input 
                              type="range" min="0" max="100" 
                              value={compFemale} 
                              onChange={(e) => setCompFemale(parseInt(e.target.value))}
                              className="absolute inset-0 opacity-0 cursor-ew-resize"
                            />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-600 font-medium">FRL</span>
                            <span className="text-gray-900">{compFRL}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
                            <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${compFRL}%` }} />
                            {compositionType === 'different' && (
                              <input 
                                type="range" min="0" max="100" 
                                value={compFRL} 
                                onChange={(e) => setCompFRL(parseInt(e.target.value))}
                                className="absolute inset-0 opacity-0 cursor-ew-resize"
                              />
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-600 font-medium">IEP</span>
                            <span className="text-gray-900">{compIEP}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
                            <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${compIEP}%` }} />
                            {compositionType === 'different' && (
                              <input 
                                type="range" min="0" max="100" 
                                value={compIEP} 
                                onChange={(e) => setCompIEP(parseInt(e.target.value))}
                                className="absolute inset-0 opacity-0 cursor-ew-resize"
                              />
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-gray-600 font-medium">ELL</span>
                            <span className="text-gray-900">{compELL}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
                            <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${compELL}%` }} />
                            {compositionType === 'different' && (
                              <input 
                                type="range" min="0" max="100" 
                                value={compELL} 
                                onChange={(e) => setCompELL(parseInt(e.target.value))}
                                className="absolute inset-0 opacity-0 cursor-ew-resize"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-[10px] text-gray-400 pt-2 text-center">
                        {compositionType === 'different' ? "Drag bars to adjust percentages" : "Values locked to school averages"}
                      </p>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        </Section>

      </div>
    </div>
  );
}
