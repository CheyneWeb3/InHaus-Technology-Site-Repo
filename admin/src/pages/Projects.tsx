import { FormEvent,useEffect,useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';
import { api,jsonBody } from '../lib/api';
import type { Project } from '../lib/types';
import { Badge,Card,Empty,Field,Modal,PageTitle } from '../components/Ui';

type ImportResult={ok:boolean;projectId:string;slug:string;created:boolean;counts:Record<string,number>};

export function Projects({kindFilter,title='Projects',subtitle='Canonical private records. Public projects are only a deliberately smaller projection.'}:{kindFilter?:string;title?:string;subtitle?:string}){
  const [items,setItems]=useState<Project[]>([]);
  const [open,setOpen]=useState(false);
  const [error,setError]=useState('');
  const [importMsg,setImportMsg]=useState('');
  const [importing,setImporting]=useState(false);
  const navigate=useNavigate();
  const load=()=>api<Project[]>('/projects').then(rows=>setItems(kindFilter?rows.filter(x=>x.kind===kindFilter):rows));
  useEffect(()=>{void load()},[kindFilter]);

  const create=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();setError('');
    const fd=new FormData(e.currentTarget);
    try{
      await api('/projects',{method:'POST',body:jsonBody({name:fd.get('name'),slug:fd.get('slug'),kind:kindFilter||fd.get('kind'),summary:fd.get('summary')})});
      setOpen(false);await load();
    }catch(e:any){setError(e.message)}
  };

  const importBundle=async(file?:File)=>{
    if(!file)return;
    setImporting(true);setError('');setImportMsg('');
    try{
      const payload=JSON.parse(await file.text());
      const result=await api<ImportResult>('/import/project-bundle',{method:'POST',body:jsonBody(payload)});
      const populated=Object.entries(result.counts).filter(([,n])=>n>0).map(([k,n])=>`${k}: ${n}`).join(' · ');
      setImportMsg(`${result.created?'Created':'Updated'} ${result.slug}. Populated ${populated}.`);
      await load();
      navigate(`/admin/projects/${result.projectId}`);
    }catch(e:any){setError(e.message)}finally{setImporting(false)}
  };

  const actions=<>
    {!kindFilter&&<label className="button">{importing?'Importing…':'Import full project JSON'}<input hidden type="file" accept=".json,application/json" disabled={importing} onChange={e=>void importBundle(e.target.files?.[0])}/></label>}
    <button className="button primary" onClick={()=>setOpen(true)}>New {kindFilter==='game'?'game':'project'}</button>
  </>;

  return <>
    <PageTitle title={title} subtitle={subtitle} actions={actions}/>
    {importMsg&&<div className="notice" style={{marginBottom:16}}>{importMsg}</div>}
    {error&&<div className="notice warn" style={{marginBottom:16}}>{error}</div>}
    <Card>{items.length?<div className="project-list">{items.map(p=><Link to={`/admin/projects/${p.id}`} className="project-row" key={p.id}><div><div className="row-title">{p.name}</div><div className="row-sub">{p.summary||p.purpose||p.slug}</div></div><div className="row-meta"><Badge tone={p.status==='active'?'active':'neutral'}>{p.status}</Badge><Badge tone={p.published?'public':'private'}>{p.published?'public':'private'}</Badge><span>{p.kind}</span><time>{new Date(p.updated_at).toLocaleDateString()}</time></div></Link>)}</div>:<Empty>No {kindFilter==='game'?'game':'project'} records yet.</Empty>}</Card>
    {open&&<Modal title={`Create ${kindFilter==='game'?'game':'project'}`} onClose={()=>setOpen(false)}><form className="form" onSubmit={create}><Field label="Name"><input name="name" required/></Field><Field label="Slug"><input name="slug" required placeholder="haus-chain"/></Field>{!kindFilter&&<Field label="Kind"><select name="kind"><option>project</option><option>game</option><option>experiment</option><option>infrastructure</option><option>other</option></select></Field>}<Field label="Summary"><textarea name="summary" rows={4}/></Field>{error&&<p className="form-error">{error}</p>}<button className="button primary">Create project shell</button></form></Modal>}
  </>;
}
