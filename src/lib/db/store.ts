import fs from "fs";
import path from "path";
import {
  Profile, Project, ProjectDocument, EventProgram, Resource, Dependency, Risk,
  HistoricalCase, Simulation, Scenario, Decision,
} from "@/types/models";

// -----------------------------------------------------------------------
// Lightweight JSON-file persistence layer.
//
// Stands in for @prisma/client in this sandbox (see prisma/schema.prisma
// header for why). Shape mirrors the Prisma schema 1:1 so swapping this
// module out for a real Prisma repository later is a drop-in replacement:
// every function signature here could be reimplemented with
// `prisma.<model>.findMany()` etc. without touching callers.
// -----------------------------------------------------------------------

interface DbShape {
  profiles: Profile[];
  projects: Project[];
  documents: ProjectDocument[];
  programs: EventProgram[];
  resources: Resource[];
  dependencies: Dependency[];
  risks: Risk[];
  historicalCases: HistoricalCase[];
  simulations: Simulation[];
  scenarios: Scenario[];
  decisions: Decision[];
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");

function emptyDb(): DbShape {
  return {
    profiles: [], projects: [], documents: [], programs: [], resources: [], dependencies: [],
    risks: [], historicalCases: [], simulations: [], scenarios: [], decisions: [],
  };
}

function ensureDb(): void {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(emptyDb(), null, 2));
}

function readDb(): DbShape {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw) as Partial<DbShape>;
    // 구버전 데이터 파일(profiles 필드 없음) 호환
    return { ...emptyDb(), ...parsed };
  } catch {
    return emptyDb();
  }
}

function writeDb(db: DbShape): void {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// A simple in-process write lock isn't needed for a single-node dev MVP,
// but we always read-modify-write atomically per call to avoid races
// across API route invocations within one Node process.
function mutate<T>(fn: (db: DbShape) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

export const db = {
  reset(): void {
    writeDb(emptyDb());
  },

  // --- Profiles ---
  listProfiles(): Profile[] {
    return readDb().profiles.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  getProfile(id: string): Profile | undefined {
    return readDb().profiles.find((p) => p.id === id);
  },
  getProfileByName(name: string): Profile | undefined {
    return readDb().profiles.find((p) => p.name === name);
  },
  createProfile(p: Profile): Profile {
    return mutate((d) => { d.profiles.push(p); return p; });
  },

  // --- Projects (프로필 소유) ---
  listProjects(profileId: string): Project[] {
    return readDb().projects.filter((p) => p.profileId === profileId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  getProject(id: string): Project | undefined {
    return readDb().projects.find((p) => p.id === id);
  },
  createProject(p: Project): Project {
    return mutate((d) => { d.projects.push(p); return p; });
  },
  updateProject(id: string, patch: Partial<Project>): Project | undefined {
    return mutate((d) => {
      const idx = d.projects.findIndex((p) => p.id === id);
      if (idx === -1) return undefined;
      d.projects[idx] = { ...d.projects[idx], ...patch, updatedAt: new Date().toISOString() };
      return d.projects[idx];
    });
  },

  // --- Documents ---
  listDocuments(projectId: string): ProjectDocument[] {
    return readDb().documents.filter((doc) => doc.projectId === projectId);
  },
  getDocument(id: string): ProjectDocument | undefined {
    return readDb().documents.find((doc) => doc.id === id);
  },
  createDocument(doc: ProjectDocument): ProjectDocument {
    return mutate((d) => { d.documents.push(doc); return doc; });
  },
  updateDocument(id: string, patch: Partial<ProjectDocument>): ProjectDocument | undefined {
    return mutate((d) => {
      const idx = d.documents.findIndex((doc) => doc.id === id);
      if (idx === -1) return undefined;
      d.documents[idx] = { ...d.documents[idx], ...patch };
      return d.documents[idx];
    });
  },

  // --- Programs ---
  listPrograms(projectId: string): EventProgram[] {
    return readDb().programs.filter((pr) => pr.projectId === projectId).sort((a, b) => a.sequence - b.sequence);
  },
  replacePrograms(projectId: string, programs: EventProgram[]): void {
    mutate((d) => {
      d.programs = d.programs.filter((pr) => pr.projectId !== projectId).concat(programs);
    });
  },
  updateProgram(id: string, patch: Partial<EventProgram>): EventProgram | undefined {
    return mutate((d) => {
      const idx = d.programs.findIndex((pr) => pr.id === id);
      if (idx === -1) return undefined;
      d.programs[idx] = { ...d.programs[idx], ...patch };
      return d.programs[idx];
    });
  },

  // --- Resources ---
  listResources(projectId: string): Resource[] {
    return readDb().resources.filter((r) => r.projectId === projectId);
  },
  replaceResources(projectId: string, resources: Resource[]): void {
    mutate((d) => {
      d.resources = d.resources.filter((r) => r.projectId !== projectId).concat(resources);
    });
  },

  // --- Dependencies ---
  listDependencies(projectId: string): Dependency[] {
    return readDb().dependencies.filter((dep) => dep.projectId === projectId);
  },
  replaceDependencies(projectId: string, deps: Dependency[]): void {
    mutate((d) => {
      d.dependencies = d.dependencies.filter((dep) => dep.projectId !== projectId).concat(deps);
    });
  },

  // --- Risks ---
  listRisks(projectId: string): Risk[] {
    return readDb().risks.filter((r) => r.projectId === projectId).sort((a, b) => b.riskScore - a.riskScore);
  },
  replaceRisks(projectId: string, risks: Risk[]): void {
    mutate((d) => {
      d.risks = d.risks.filter((r) => r.projectId !== projectId).concat(risks);
    });
  },
  updateRisk(id: string, patch: Partial<Risk>): Risk | undefined {
    return mutate((d) => {
      const idx = d.risks.findIndex((r) => r.id === id);
      if (idx === -1) return undefined;
      d.risks[idx] = { ...d.risks[idx], ...patch };
      return d.risks[idx];
    });
  },

  // --- Historical cases (프로필 단위로 공유 — 다른 프로필에는 노출되지 않음) ---
  listHistoricalCases(profileId: string): HistoricalCase[] {
    return readDb().historicalCases.filter((c) => c.profileId === profileId);
  },
  addHistoricalCases(cases: HistoricalCase[]): void {
    mutate((d) => { d.historicalCases.push(...cases); });
  },

  // --- Simulations ---
  getSimulation(id: string): Simulation | undefined {
    return readDb().simulations.find((s) => s.id === id);
  },
  listSimulations(projectId: string): Simulation[] {
    return readDb().simulations.filter((s) => s.projectId === projectId);
  },
  createSimulation(sim: Simulation): Simulation {
    return mutate((d) => { d.simulations.push(sim); return sim; });
  },
  updateSimulation(id: string, patch: Partial<Simulation>): Simulation | undefined {
    return mutate((d) => {
      const idx = d.simulations.findIndex((s) => s.id === id);
      if (idx === -1) return undefined;
      d.simulations[idx] = { ...d.simulations[idx], ...patch };
      return d.simulations[idx];
    });
  },

  // --- Scenarios ---
  listScenarios(simulationId: string): Scenario[] {
    return readDb().scenarios.filter((s) => s.simulationId === simulationId);
  },
  getScenario(id: string): Scenario | undefined {
    return readDb().scenarios.find((s) => s.id === id);
  },
  addScenarios(scenarios: Scenario[]): void {
    mutate((d) => { d.scenarios.push(...scenarios); });
  },
  updateScenario(id: string, patch: Partial<Scenario>): Scenario | undefined {
    return mutate((d) => {
      const idx = d.scenarios.findIndex((s) => s.id === id);
      if (idx === -1) return undefined;
      d.scenarios[idx] = { ...d.scenarios[idx], ...patch };
      return d.scenarios[idx];
    });
  },

  // --- Decisions ---
  listDecisions(simulationId: string): Decision[] {
    return readDb().decisions.filter((dec) => dec.simulationId === simulationId);
  },
  addDecision(dec: Decision): Decision {
    return mutate((d) => { d.decisions.push(dec); return dec; });
  },
};
