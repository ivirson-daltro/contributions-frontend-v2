export type MemberStatus = 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED' | 'DECEASED';
export type MemberStatusFilter = MemberStatus | 'ALL';

export interface MemberType {
  id: string;
  description: string;
}

export interface MemberSummary {
  id: string;
  name: string;
  memberType: MemberType;
  status: MemberStatus;
  phone: string | null;
}

export interface Member extends MemberSummary {
  email: string | null;
  gender: string | null;
  birthDate: string | null;
  entryDate: string | null;
  baptismDate: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  consentAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberPayload {
  name: string;
  memberTypeId: string;
  status?: MemberStatus;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  entryDate?: string | null;
  baptismDate?: string | null;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  consent?: boolean;
}

export interface MemberQuery {
  q?: string;
  memberTypeId?: string;
  status: MemberStatusFilter;
  page: number;
  pageSize: number;
  sort: 'name' | 'type' | 'createdAt';
  order: 'asc' | 'desc';
}

export interface MemberList {
  data: MemberSummary[];
  meta: { page: number; pageSize: number; total: number };
}

export interface Contributor {
  id: string;
  name: string;
  memberType: { id: string; description: string };
  months: boolean[];
}

export interface ContributorList {
  data: Contributor[];
  meta: { page: number; pageSize: number; total: number };
}

export interface ContributorQuery {
  year: number;
  q?: string;
  page: number;
  pageSize: number;
  sort: 'name' | 'type';
  order: 'asc' | 'desc';
}
