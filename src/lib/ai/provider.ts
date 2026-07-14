export interface DocumentStructureResult {
  eventSummary: {
    eventName: string;
    eventType: string;
    date: string;
    venue: string;
    audienceSize: number | null;
    objectives: string[];
  };
  programs: Array<{
    title: string;
    programType: string;
    startTime: string;
    endTime: string;
    location: string;
    responsiblePersons: string[];
    requiredResources: string[];
    preconditions: string[];
    backupPlans: string[];
    decisionMaker: string;
    confidence: number; // 0-1
    sources: string[];
  }>;
  resources: Array<{ name: string; resourceType: string; criticality: string }>;
  dependencies: Array<{ description: string; dependencyType: string }>;
  knownRisks: Array<{ title: string; description: string; category: string }>;
  missingInformation: string[];
  documentConflicts: string[];
}

export interface HistoricalCaseExtractionItem {
  eventType: string;
  eventPhase: string;
  situation: string;
  rootCause: string;
  immediateResponse: string;
  finalOutcome: string;
  severity: number;
  preventable: boolean;
  preventionActions: string[];
  relatedResources: string[];
  tags: string[];
  sourceReference: string;
}

/** AI provider abstraction — swap Mock <-> Claude without touching callers. */
export interface AIProvider {
  readonly name: "mock" | "claude";
  structureDocument(text: string, category: string, filename: string): Promise<DocumentStructureResult>;
  extractHistoricalCases(text: string, filename: string): Promise<HistoricalCaseExtractionItem[]>;
}
