import { useEffect,useState } from 'react';
import { api } from '../lib/api';
import { Card,Empty,PageTitle } from '../components/Ui';
export function Audit(){const [items,setItems]=useState<any[]>([]);useEffect(()=>{api<any[]>('/audit').then(setItems)},[]);return <><PageTitle title="Audit history" subtitle="Authentication, edits, publishing, repository assignments and knowledge sync actions are recorded."/><Card>{items.length?<div className="audit-table">{items.map(x=><div key={x.id}><time>{new Date(x.created_at).toLocaleString()}</time><strong>{x.action}</strong><span>{x.entity_type}</span><code>{x.project_id||x.entity_id||'—'}</code></div>)}</div>:<Empty>No audit records yet.</Empty>}</Card></>}
