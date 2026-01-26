// ============================================
// USER TYPES
// ============================================

export type UserRole = 'ADMIN' | 'MANAGER' | 'TEAM_LEAD' | 'DEVELOPER' | 'DESIGNER';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INVITED';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  invitedById?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser extends User {
  accessToken: string;
}

// ============================================
// FIVERR ACCOUNT TYPES
// ============================================

export interface FiverrAccount {
  id: string;
  accountName: string;
  accountEmail?: string;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// PROJECT TYPES
// ============================================

export type ProjectStatus =
  | 'NEW'
  | 'REQUIREMENTS_PENDING'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'CLIENT_REVIEW'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED';

export type ProjectComplexity = 'SIMPLE' | 'MEDIUM' | 'COMPLEX';
export type ProjectPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Project {
  id: string;
  internalName: string;
  projectType: string;
  complexity: ProjectComplexity;
  priority: ProjectPriority;
  internalDeadline?: string;
  fiverrDeadline?: string;
  meetingLink?: string;
  domainLink?: string;
  stagingLink?: string;
  stagingPassword?: string;
  clientEmail?: string;
  clientUsername?: string;
  status: ProjectStatus;
  budget?: string; // Only visible to Admin
  fiverrAccountId: string;
  fiverrAccount?: FiverrAccount; // Only visible to Admin & Manager
  createdById: string;
  createdBy?: User;
  managerId?: string;
  manager?: User;
  teamLeadId?: string;
  teamLead?: User;
  designerId?: string;
  designer?: User;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// REQUIREMENT TYPES
// ============================================

export type RequirementStatus = 'DRAFT' | 'APPROVED';

export interface RequirementContent {
  overview: string;
  pages: string[];
  functional: string[];
  designNotes: string;
  plugins: string[];
  outOfScope: string[];
}

export interface Requirement {
  id: string;
  projectId: string;
  version: number;
  content: RequirementContent;
  attachments?: string[];
  status: RequirementStatus;
  createdById: string;
  createdBy?: User;
  approvedById?: string;
  approvedBy?: User;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// TASK TYPES
// ============================================

export type TaskStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface Task {
  id: string;
  projectId: string;
  project?: Project;
  title: string;
  description?: string;
  priority: number;
  dueDate?: string;
  status: TaskStatus;
  assignedToId: string;
  assignedTo?: User;
  assignedById: string;
  assignedBy?: User;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// DESIGN ASSET TYPES
// ============================================

export type AssetType = 'LOGO' | 'BANNER' | 'IMAGE' | 'ICON' | 'OTHER';
export type AssetStatus = 'REQUESTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface DesignAsset {
  id: string;
  projectId: string;
  project?: Project;
  assetType: AssetType;
  name: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  status: AssetStatus;
  requestedById: string;
  requestedBy?: User;
  uploadedById?: string;
  uploadedBy?: User;
  approvedById?: string;
  approvedBy?: User;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// REVISION TYPES
// ============================================

export type RevisionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface Revision {
  id: string;
  projectId: string;
  project?: Project;
  description: string;
  attachments?: string[];
  isPaid: boolean;
  status: RevisionStatus;
  createdById: string;
  createdBy?: User;
  assignedTeamLeadId?: string;
  assignedDeveloperId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// CHAT TYPES
// ============================================

export interface ChatMessage {
  id: string;
  projectId: string;
  senderId: string;
  sender?: User;
  message: string;
  attachments?: string[];
  visibleToRoles: UserRole[];
  createdAt: string;
}

// ============================================
// NOTIFICATION TYPES
// ============================================

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  referenceType?: string;
  referenceId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// ============================================
// AUDIT LOG TYPES
// ============================================

export interface AuditLog {
  id: string;
  userId: string;
  user?: User;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ============================================
// SYSTEM SETTINGS TYPES
// ============================================

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export interface N8nSettings {
  enabled: boolean;
  webhookUrl: string;
  apiKey: string;
}

export interface GeneralSettings {
  companyName: string;
  timezone: string;
  dateFormat: string;
  notificationsEnabled: boolean;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
}

// ============================================
// FORM TYPES
// ============================================

export interface LoginFormData {
  email: string;
  password: string;
}

export interface CreateUserFormData {
  email: string;
  name: string;
  role: UserRole;
}

export interface CreateProjectFormData {
  internalName: string;
  fiverrAccountId: string;
  projectType: string;
  complexity: ProjectComplexity;
  priority: ProjectPriority;
  internalDeadline?: string;
  fiverrDeadline?: string;
  budget?: string;
  meetingLink?: string;
  stagingLink?: string;
  stagingPassword?: string;
  clientEmail?: string;
  clientUsername?: string;
}

export interface CreateRequirementFormData {
  content: RequirementContent;
  attachments?: string[];
}

export interface CreateTaskFormData {
  title: string;
  description?: string;
  assignedToId: string;
  priority?: number;
  dueDate?: string;
}

export interface CreateRevisionFormData {
  description: string;
  attachments?: string[];
  isPaid: boolean;
}
