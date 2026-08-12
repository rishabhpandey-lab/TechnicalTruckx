require('dotenv').config();
const express=require('express');
const path=require('path');
const crypto=require('crypto');
const {MongoClient,ObjectId}=require('mongodb');
const app=express();
const client=new MongoClient(process.env.MONGODB_URI);
let db;
app.use(express.json());
app.use(express.static(__dirname));

app.get('/api/health',(req,res)=>res.json({ok:true}));

app.get('/api/flows/:queue/issues',async(req,res)=>{
  const issues=await db.collection('issues').find({queue:req.params.queue,active:true}).sort({createdAt:1}).project({_id:0}).toArray();
  res.json({issues});
});

app.get('/api/flows/:queue/nodes/:nodeId',async(req,res)=>{
  const node=await db.collection('flow_nodes').findOne({queue:req.params.queue,nodeId:req.params.nodeId,active:true},{projection:{_id:0}});
  if(!node)return res.status(404).json({error:'Flow step not found'});
  res.json({node});
});

app.get('/api/admin/flows/:queue/issues',async(req,res)=>{
  const issues=await db.collection('issues').find({queue:req.params.queue}).sort({createdAt:1}).project({_id:0}).toArray();
  res.json({issues});
});

app.post('/api/admin/flows/:queue/issues',async(req,res)=>{
  const title=String(req.body.title||'').trim();
  if(!title)return res.status(400).json({error:'Issue title is required'});
  const queue=req.params.queue;
  if(!['Technical','Billing'].includes(queue))return res.status(400).json({error:'Invalid category'});
  const issueId=crypto.randomUUID();
  await db.collection('issues').insertOne({issueId,queue,title,active:true,createdAt:new Date(),updatedAt:new Date()});
  res.json({issueId,title,queue});
});

app.put('/api/admin/issues/:issueId',async(req,res)=>{
  const title=String(req.body.title||'').trim();
  if(!title)return res.status(400).json({error:'Issue title is required'});
  const result=await db.collection('issues').updateOne({issueId:req.params.issueId},{$set:{title,updatedAt:new Date()}});
  if(!result.matchedCount)return res.status(404).json({error:'Issue not found'});
  res.json({ok:true});
});

app.delete('/api/admin/issues/:issueId',async(req,res)=>{
  const result=await db.collection('issues').updateOne({issueId:req.params.issueId},{$set:{active:false,updatedAt:new Date()}});
  if(!result.matchedCount)return res.status(404).json({error:'Issue not found'});
  res.json({ok:true});
});

app.post('/api/journeys',async(req,res)=>{
  const {queue,path,data,startedAt}=req.body;
  if(!queue||!Array.isArray(path)||!path.length)return res.status(400).json({error:'Invalid journey'});
  let journeyId;
  do{journeyId=`TT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;}while(await db.collection('journeys').findOne({journeyId}));
  await db.collection('journeys').insertOne({journeyId,queue,path,data:data||{},startedAt:new Date(startedAt||Date.now()),completedAt:new Date()});
  res.json({journeyId});
});

app.get('/api/journeys/:journeyId',async(req,res)=>{
  const journey=await db.collection('journeys').findOne({journeyId:req.params.journeyId},{projection:{_id:0}});
  if(!journey)return res.status(404).json({error:'Journey ID not found'});
  res.json({journey});
});

async function start(){
  await client.connect();
  db=client.db(process.env.MONGODB_DB||'support_workflow');
  await db.collection('issues').createIndex({queue:1,active:1,createdAt:1});
  await db.collection('journeys').createIndex({journeyId:1},{unique:true});
  app.listen(process.env.PORT||3000,()=>console.log(`Server running on http://localhost:${process.env.PORT||3000}`));
}
start().catch(err=>{console.error(err);process.exit(1);});
