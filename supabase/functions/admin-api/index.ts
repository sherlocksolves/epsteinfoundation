import {db,reply,preflight,clean,limited} from "./_shared.ts";
async function authGoogle(client:any,req:Request){
  try {
    const bearer=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i);
    if(!bearer)return null;
    const {data,error}=await client.auth.getUser(bearer[1]);
    const user=data?.user;
    if(error||!user?.id||!user.email_confirmed_at||user.email?.toLowerCase()!=="viratanand1221@gmail.com")return null;
    return {sub:user.id,email:user.email};
  } catch { return null; }
}

Deno.serve(async(req)=>{
  const p=preflight(req);if(p)return p;
  try{
    const client=db(),action=new URL(req.url).searchParams.get("action")||"";
    if(req.method==="POST"&&action==="submit-community"){
      if(!await limited(client,req))return reply({success:false,error:"Too many submissions. Please try again in a few minutes."},429);
      const b=await req.json(),type=clean(b.type,30)||"volunteer",fullName=clean(b.fullName,100),contact=clean(b.contact,120),location=clean(b.location,100),role=clean(b.role,120),message=clean(b.message,1200);
      if(!fullName||!contact||!message)return reply({success:false,error:"Name, contact, and message are required."},400);
      const txId="vol_"+Date.now()+"_"+crypto.randomUUID().slice(0,8);
      const {error}=await client.from("private_contributions").insert({tx_hash:txId,network:"btc",recipient:"community_inbox",sender:fullName+" ("+contact+")",amount_num:0.00000001,amount_display:type.toUpperCase(),note:message,raw_payload:{record_type:"community_submission",submission_type:type,fullName,contact,location,role,message,status:"new"}});
      if(error)throw error;
      return reply({success:true,message:"Submission received."});
    }
    const who=await authGoogle(client,req);
    if(!who)return reply({success:false,error:"Admin session expired. Sign in again."},401);
    if(req.method==="GET"&&action==="contributions"){
      const [priv,pub,settings]=await Promise.all([client.from("private_contributions").select("*").order("verified_at",{ascending:false}).limit(500),client.from("public_leaderboard").select("*").order("verified_at",{ascending:false}).limit(500),client.from("app_settings").select("btc_address,bsc_address").eq("id",1).single()]);
      if(priv.error||pub.error)throw priv.error||pub.error;
      const allPriv=priv.data||[],cmsRow=allPriv.find((r:any)=>r.tx_hash==="__cms_config__"),volunteers=allPriv.filter((r:any)=>r.tx_hash?.startsWith("vol_")||r.raw_payload?.record_type==="community_submission"),donations=allPriv.filter((r:any)=>r.tx_hash!=="__cms_config__"&&!r.tx_hash?.startsWith("vol_")&&r.raw_payload?.record_type!=="community_submission");
      return reply({success:true,private_contributions:donations,public_leaderboard:pub.data||[],volunteers,cms:cmsRow?.raw_payload||null,settings:settings.data});
    }
    if(req.method==="POST"&&action==="save-cms"){
      const b=await req.json(),cmsPayload={projectTitle:clean(b.projectTitle,100)||"Epstein Foundation",tagline:clean(b.tagline,120)||"For Children.",heroBadge:clean(b.heroBadge,80)||"Direct Community Support",bannerImage:clean(b.bannerImage,300)||"assets/banner.jpg",storyTitle:clean(b.storyTitle,140)||"Every Child Deserves a Fair Start.",storySubtitle:clean(b.storySubtitle,180)||"Direct, transparent community support—with zero middlemen.",storyParagraphs:Array.isArray(b.storyParagraphs)?b.storyParagraphs.map((x:unknown)=>clean(x,600)).filter(Boolean):[],announcement:{enabled:Boolean(b.announcement?.enabled),text:clean(b.announcement?.text,240)},campaignGoal:{enabled:Boolean(b.campaignGoal?.enabled),title:clean(b.campaignGoal?.title,100)||"Current Community Milestone",currentDisplay:clean(b.campaignGoal?.currentDisplay,100)||"",percentage:Math.min(100,Math.max(0,Number(b.campaignGoal?.percentage)||0))},social:{instagram:clean(b.social?.instagram,200)||"https://www.instagram.com/epsteinfoundationforchildren",x:clean(b.social?.x,200)||"https://x.com/epsteinfnd"},footerNotice:clean(b.footerNotice,240)||"Epstein Foundation — For Children. Direct community support with real-time on-chain verification.",copyright:clean(b.copyright,160)||"© 2026 Epstein Foundation. For Children."};
      const {error}=await client.from("private_contributions").upsert({tx_hash:"__cms_config__",network:"btc",recipient:"cms_config",sender:who.sub,amount_num:0.00000001,amount_display:"CMS",note:"Homepage CMS Configuration",raw_payload:cmsPayload},{onConflict:"tx_hash"});
      if(error)throw error;return reply({success:true,cms:cmsPayload});
    }
    if(req.method==="POST"&&action==="add-supporter"){
      const b=await req.json(),displayName=clean(b.displayName,60)||"Anonymous Supporter",network=b.network==="BEP-20"?"BEP-20":"BTC",amountDisplay=clean(b.amountDisplay,40)||"Verified Support",amountNum=Math.max(0.00000001,Number(b.amountNum)||0.001),note=clean(b.note,300),txHash=clean(b.txHash,100)||("manual_"+Date.now()+"_"+crypto.randomUUID().slice(0,6));
      const {error:pubErr}=await client.from("public_leaderboard").insert({tx_hash:txHash,display_name:displayName,network,amount_display:amountDisplay,amount_num:amountNum,status:"verified"});
      if(pubErr)throw pubErr;
      await client.from("private_contributions").upsert({tx_hash:txHash,network:network==="BTC"?"btc":"bsc",recipient:"manual_admin_entry",sender:displayName,amount_num:amountNum,amount_display:amountDisplay,note:note||"Added manually by Admin",raw_payload:{manual:true,addedBy:who.sub}},{onConflict:"tx_hash"});
      return reply({success:true});
    }
    if(req.method==="POST"&&action==="edit-supporter"){
      const b=await req.json(),id=clean(b.id,80);if(!id)return reply({success:false,error:"Missing supporter ID."},400);
      const update:any={};if(b.displayName!==undefined)update.display_name=clean(b.displayName,60)||"Anonymous Supporter";if(b.amountDisplay!==undefined)update.amount_display=clean(b.amountDisplay,40);if(b.network==="BTC"||b.network==="BEP-20")update.network=b.network;
      const {error}=await client.from("public_leaderboard").update(update).eq("id",id);if(error)throw error;return reply({success:true});
    }
    if(req.method==="POST"&&action==="manage-volunteer"){
      const b=await req.json(),id=clean(b.id,80),mode=b.mode;if(!id)return reply({success:false,error:"Missing record ID."},400);
      if(mode==="delete"){const {error}=await client.from("private_contributions").delete().eq("id",id);if(error)throw error;}
      return reply({success:true});
    }
    if(req.method==="POST"&&action==="update-settings"){
      const b=await req.json(),btc=clean(b.btc_address,100),bsc=clean(b.bsc_address,100);
      if(!/^([13]|bc1)[a-zA-HJ-NP-Z0-9]{20,90}$/.test(btc)||!/^0x[a-fA-F0-9]{40}$/.test(bsc))return reply({success:false,error:"Invalid receiving address format."},400);
      const {error}=await client.from("app_settings").update({btc_address:btc,bsc_address:bsc,updated_at:new Date().toISOString()}).eq("id",1);if(error)throw error;return reply({success:true});
    }
    if(req.method==="POST"&&action==="moderate-entry"){
      const b=await req.json(),id=clean(b.id,80),mode=b.mode;if(!id||!["hide","restore","delete"].includes(mode))return reply({success:false,error:"Invalid moderation request."},400);
      let q=client.from("public_leaderboard").delete().eq("id",id);if(mode==="hide")q=client.from("public_leaderboard").update({status:"hidden"}).eq("id",id);if(mode==="restore")q=client.from("public_leaderboard").update({status:"verified"}).eq("id",id);
      const {error}=await q;if(error)throw error;return reply({success:true});
    }
    return reply({success:false,error:"Unknown operation."},404);
  }catch(e){console.error(e);return reply({success:false,error:"Admin API operation failed."},500);}
});