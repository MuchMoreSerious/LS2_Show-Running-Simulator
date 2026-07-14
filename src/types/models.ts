// Core domain types — mirror prisma/schema.prisma 1:1.
// JSON-typed columns in the schema (stored as strings in SQLite) are
// represented here as their real TS shapes; the JSON-store repository layer
// (src/lib/db/store.ts) handles serialize/deserialize.

export type ImportanceLevel = "low" | "medium" | "high" | "critical";
export type SafetySensitivity = "low" | "medium" | "high";

export interface Project {
  id: string;
  name: string;
  eventType: EventType;
  eventDate: string; // ISO date
  venue: string;
  clientName: string;
  audienceSize: number;
  importanceLevel: ImportanceLevel;
  safetySensitivity: SafetySensitivity;
  keyPrograms: string[];
  keyPeople: string[];
  keyEquipment: string[];
  readinessScore: number;
  createdAt: string;
  updatedAt: string;
}

export type EventType =
  | "corporate_press_conference"
  | "new_vehicle_launch"
  | "exhibition_booth_showcase"
  | "brand_event"
  | "stage_conference";

export type DocumentCategory =
  | "manual"
  | "full_timetable"
  | "cue_sheet"
  | "staffing"
  | "equipment_list"
  | "content_list"
  | "readiness_sheet"
  | "floor_plan"
  | "past_report"
  | "incident_log";

export type ProcessingStatus =
  | "uploaded"
  | "extracting"
  | "analyzing"
  | "needs_review"
  | "completed"
  | "error";

export interface ProjectDocument {
  id: string;
  projectId: string;
  filename: string;
  fileType: "pdf" | "docx" | "xlsx" | "csv" | "txt" | "md";
  documentCategory: DocumentCategory;
  storagePath: string;
  processingStatus: ProcessingStatus;
  extractedText: string | null;
  errorMessage: string | null;
  createdAt: string;
  /** AI 구조화 결과 (검토 전, DB의 정식 Program/Resource/Risk에는 아직 반영되지 않음) */
  analysisResult?: unknown;
}

export type Confidence = "document_stated" | "cross_document_inference" | "ai_estimate";
export type ProgramStatus = "planned" | "at_risk" | "delayed" | "in_progress" | "completed" | "skipped";

export interface EventProgram {
  id: string;
  projectId: string;
  title: string;
  programType: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  location: string;
  description?: string;
  status: ProgramStatus;
  sequence: number;
  responsiblePersons: string[];
  requiredResources: string[];
  preconditions: string[];
  backupPlans: string[];
  decisionMaker?: string;
  failureImpact?: string;
  sourceDocumentId?: string;
  confidence: Confidence;
}

export type ResourceType =
  | "person" | "presenter" | "staff" | "equipment" | "vehicle"
  | "robot" | "content" | "space" | "power" | "network";
export type ResourceStatus = "ready" | "pending" | "at_risk" | "unavailable";

export interface Resource {
  id: string;
  projectId: string;
  name: string;
  resourceType: ResourceType;
  owner?: string;
  quantity: number;
  status: ResourceStatus;
  backupAvailable: boolean;
  criticality: "low" | "medium" | "high" | "critical";
}

export type DependencyType = "must_finish_before" | "requires" | "shares_resource" | "blocks" | "backup_for";

export interface Dependency {
  id: string;
  projectId: string;
  sourceType: "program" | "resource";
  sourceId: string;
  targetType: "program" | "resource";
  targetId: string;
  dependencyType: DependencyType;
  description?: string;
}

export type RiskCategory =
  | "schedule" | "staffing" | "equipment" | "content" | "presenter" | "vehicle"
  | "robot" | "safety" | "client" | "audience" | "media" | "weather" | "venue"
  | "comms" | "power";
export type EvidenceType = "manual" | "readiness" | "historical_case" | "general_knowledge" | "ai_estimate";

export interface Risk {
  id: string;
  projectId: string;
  title: string;
  category: RiskCategory;
  description: string;
  probability: number; // 1-5
  impact: number; // 1-5
  detectabilityMod: number; // 0.8 | 1.0 | 1.2
  riskScore: number;
  relatedProgramId?: string;
  relatedResourceId?: string;
  evidenceType: EvidenceType;
  evidenceText?: string;
  mitigation?: string;
  status: "open" | "mitigated" | "accepted" | "resolved";
}

export interface HistoricalCase {
  id: string;
  sourceDocumentId: string;
  eventType: string;
  situation: string;
  rootCause: string;
  response: string;
  outcome: string;
  severity: number;
  preventable: boolean;
  prevention?: string;
  relatedResources?: string[];
  tags: string[];
}

export type Difficulty = "easy" | "normal" | "hard" | "live_ops";
export type SimulationPhase = "load_in" | "tech_rehearsal" | "full_rehearsal" | "pre_show" | "show" | "load_out";
export type EventFrequency = "low" | "normal" | "high";
export type SimulationStatus = "not_started" | "running" | "paused" | "completed";

export interface Simulation {
  id: string;
  projectId: string;
  difficulty: Difficulty;
  phases: SimulationPhase[];
  eventFrequency: EventFrequency;
  includedRiskCategories: RiskCategory[];
  currentTime: string;
  status: SimulationStatus;
  overallScore: number;
  scheduleScore: number;
  safetyScore: number;
  productionScore: number;
  clientScore: number;
  costScore: number;
  fatigueScore: number;
  startedAt?: string;
  completedAt?: string;
}

export type ScenarioSeverity = "low" | "medium" | "high" | "critical";
export type ScenarioSourceType = "deterministic_data" | "probabilistic" | "historical_case" | "chain_reaction";
export type ScenarioStatus = "pending" | "active" | "resolved" | "expired";

export interface ScoreEffects {
  schedule: number;
  safety: number;
  production: number;
  client: number;
  cost: number;
  fatigue: number;
}

export interface ScenarioOption {
  id: string;
  scenarioId: string;
  label: string; // "A", "B", "C"...
  description: string;
  immediateEffects: ScoreEffects;
  delayedEffects?: Partial<ScoreEffects>;
  scoreEffects: ScoreEffects; // combined view for report/UI
  newRiskTriggers?: string[];
}

export interface Scenario {
  id: string;
  simulationId: string;
  triggerTime: string;
  category: RiskCategory | "chain";
  title: string;
  description: string;
  severity: ScenarioSeverity;
  relatedProgramId?: string;
  relatedResourceId?: string;
  sourceType: ScenarioSourceType;
  sourceReference?: string;
  status: ScenarioStatus;
  options: ScenarioOption[];
  decisionTimeLimitSec: number;
  peopleInvolved?: string[];
  equipmentInvolved?: string[];
}

export interface Decision {
  id: string;
  simulationId: string;
  scenarioId: string;
  selectedOptionId?: string;
  customResponse?: string;
  reasoning?: string;
  scoreChange: ScoreEffects;
  createdAt: string;
  evaluation?: DecisionEvaluation;
}

export interface DecisionEvaluation {
  immediateResult: string;
  scheduleImpact: string;
  safetyImpact: string;
  productionImpact: string;
  costImpact: string;
  newRisks: string[];
  evidence: EvidenceRef[];
  betterAlternative?: string;
}

export interface EvidenceRef {
  type: EvidenceType;
  label: string;
  detail?: string;
}

export interface SimulationReport {
  simulationId: string;
  projectId: string;
  overallScore: number;
  scheduleScore: number;
  safetyScore: number;
  productionScore: number;
  clientScore: number;
  costScore: number;
  fatigueScore: number;
  mostVulnerablePhase: string;
  riskiestResource: string;
  mostRepeatedIssue: string;
  goodDecisions: string[];
  riskyDecisions: string[];
  unresolvedItems: string[];
  mustFixBeforeEvent: string[];
  recommendedRehearsals: string[];
  recommendedChecklist: string[];
  manualUpdateSuggestions: string[];
  generatedAt: string;
}
