export type Role = "client" | "maker";

export interface MakerProfile {
  headline: string;
  printers: string[];
  materials: string[];
  buildVolume: string; // np. "256 × 256 × 256 mm"
  hourlyRate: number; // zł / h pracy maszyny
  leadDays: number; // typowy czas realizacji
  available: boolean;
  rating: number; // 0–5
  jobsDone: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passHash: string;
  role: Role;
  city: string;
  bio: string;
  createdAt: number;
  maker?: MakerProfile;
}

export type PublicUser = Omit<User, "passHash" | "email">;

export type RequestStatus =
  | "pending" // czeka na decyzję drukarza (makerId)
  | "help_requested" // drukarz poprosił o pomoc i czeka na odpowiedź
  | "accepted" // przyjęte do realizacji
  | "printing" // w trakcie druku
  | "ready" // gotowe do odbioru / wysłane
  | "completed" // potwierdzone przez zamawiającego
  | "rejected" // odrzucone przez drukarza
  | "cancelled"; // anulowane

export type EventType =
  | "created"
  | "accepted"
  | "rejected"
  | "help_asked"
  | "help_accepted"
  | "help_rejected"
  | "printing"
  | "ready"
  | "completed"
  | "cancelled"
  | "reassigned"
  | "comment";

export interface RequestEvent {
  id: string;
  at: number;
  actorId: string;
  type: EventType;
  note?: string;
  refId?: string; // powiązane zapytanie (np. prośba o pomoc)
}

export interface PrintRequest {
  id: string;
  code: string; // WR-1042
  title: string;
  description: string;
  clientId: string; // zamawiający całego zlecenia
  makerId: string; // drukarz, do którego obecnie skierowane jest to zapytanie
  requestedById?: string; // dla próśb o pomoc: drukarz, który poprosił
  parentId?: string;
  rootId: string;
  participants: string[]; // kto może widzieć (utrzymywane na root)
  material: string;
  color: string;
  quantity: number;
  dims: string; // "120 × 80 × 40 mm"
  infill: number; // %
  layerHeight: number; // mm
  deadline?: string; // YYYY-MM-DD
  budget?: number; // zł
  fileUrl?: string;
  quote?: number; // wycena drukarza, zł
  eta?: string; // YYYY-MM-DD
  status: RequestStatus;
  events: RequestEvent[];
  createdAt: number;
  updatedAt: number;
}

export const MATERIALS = [
  "PLA",
  "PLA Silk",
  "PETG",
  "ABS",
  "ASA",
  "TPU 95A",
  "PA-CF",
  "PC",
  "Żywica standard",
  "Żywica twarda",
] as const;
