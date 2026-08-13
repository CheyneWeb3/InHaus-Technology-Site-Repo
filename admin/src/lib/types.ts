export type Project = {
  id: string; slug: string; name: string; internal_name?: string; kind: string; summary: string; purpose: string;
  stage: string; status: string; notes: string; updated_at: string; published?: boolean; featured?: boolean; sort_order?: number;
  public_slug?: string; public_title?: string;
};
export type ProjectBundle = {
  project: Project; aliases: any[]; publicProfile: any | null; networks: any[]; endpoints: any[]; repositories: any[];
  contracts: any[]; infrastructure: any[]; secretReferences: any[]; documents: any[]; procedures: any[]; assets: any[]; decisions: any[];
};
export type ComponentRecord = { id:string; slug:string; name:string; category:string; purpose:string; status:string; current_version?:string };
