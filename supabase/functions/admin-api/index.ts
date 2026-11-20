import {db,reply as baseReply,preflight,clean,limited} from "./_shared.ts";
const enc=(a:Uint8Array)=>btoa(String.fromCharCode(...a)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const dec=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"===".slice((s.length+3)%4)),c=>c.charCodeAt(0));
async function hashPass(pass:string){const salt=crypto.getRandomValues(new Uint8Array(16)),rounds=310000,k=await crypto.subtle.importKey("raw",new TextEncoder().encode(pass),"PBKDF2",false,["deriveBits"]),v=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations:rounds},k,256));return "pbkdf2_sha256$"+rounds+"$"+enc(salt)+"$"+enc(v);}
async function checkPass(pass:string,stored:string){try{const [alg,n,salt,want]=stored.split("$");if(alg!=="pbkdf2_sha256"||Number(n)<100000)return false;const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(pass),"PBKDF2",false,["deriveBits"]),v=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:dec(salt),iterations:Number(n)},k,256)),got=enc(v);if(got.length!==want.length)return false;let d=0;for(let i=0;i<got.length;i++)d|=got.charCodeAt(i)^want.charCodeAt(i);return d===0;}catch{return false;}}
async function key(){const secrets=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}"),secret=secrets.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!secret)throw new Error("Server signing key unavailable");const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("direct-support-admin:"+secret));return crypto.subtle.importKey("raw",digest,{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);}
async function token(user:string){const now=Math.floor(Date.now()/1000),head=enc(new TextEncoder().encode(JSON.stringify({alg:"HS256",typ:"JWT"}))),body=enc(new TextEncoder().encode(JSON.stringify({sub:user,iat:now,exp:now+7200}))),input=head+"."+body,sig=new Uint8Array(await crypto.subtle.sign("HMAC",await key(),new TextEncoder().encode(input)));return input+"."+enc(sig);}
async function auth(req:Request){try{const p=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").split(".");if(p.length!==3)return null;const ok=await crypto.subtle.verify("HMAC",await key(),dec(p[2]),new TextEncoder().encode(p[0]+"."+p[1]));if(!ok)return null;const v=JSON.parse(new TextDecoder().decode(dec(p[1])));return v.exp>Date.now()/1000&&v.sub?v:null;}catch{return null;}}

Deno.serve(async(req)=>{
  const p=preflight(req);if(p)return p;
  try{
    const client=db(),action=new URL(req.url).searchParams.get("action")||"";
    const respond=(data:unknown,status=200)=>baseReply(data,status,req);
    const reply=respond;

    // Public Endpoint: Volunteer & Community Feedback Submission
    if(req.method==="POST"&&action==="submit-community"){
      if(!await limited(client,req))return reply({success:false,error:"Too many submissions. Please try again in a few minutes."},429);
      const b=await req.json();
      const type=clean(b.type,30)||"volunteer";
      const fullName=clean(b.fullName,100);
      const contact=clean(b.contact,120);
      const location=clean(b.location,100);
      const role=clean(b.role,120);
      const message=clean(b.message,1200);
      if(!fullName||!contact||!message)return reply({success:false,error:"Name, contact, and message are required."},400);
      const txId="vol_"+Date.now()+"_"+crypto.randomUUID().slice(0,8);
      const {error}=await client.from("private_contributions").insert({
        tx_hash:txId,
        network:"btc",
        recipient:"community_inbox",
        sender:fullName+" ("+contact+")",
        amount_num:0.00000001,
        amount_display:type.toUpperCase(),
        note:message,
        raw_payload:{record_type:"community_submission",submission_type:type,fullName,contact,location,role,message,status:"new"}
      });
      if(error)throw error;
      return reply({success:true,message:"Submission received."});
    }

    // Admin Login
    if(req.method==="POST"&&action==="login"){
      if(!await limited(client,req))return respond({success:false,error:"Too many login attempts. Try again in 10 minutes."},429);
      const b=await req.json(),user=clean(b.username,80),pass=typeof b.password==="string"?b.password.slice(0,256):"";
      const {data}=await client.from("admin_users").select("username,password_hash").eq("username",user).maybeSingle();
      if(!data||!(await checkPass(pass,data.password_hash)))return respond({success:false,error:"Invalid username or password."},401);
      return respond({success:true,token:await token(data.username),username:data.username,expiresIn:7200});
    }

    // Google OAuth Admin Verification
    if(req.method==="POST"&&action==="google-login"){
      const b=await req.json();
      const accessToken=clean(b.accessToken,4000);
      if(!accessToken)return respond({success:false,error:"Missing access token."},400);

      const {data:{user},error:userError}=await client.auth.getUser(accessToken);
      if(userError||!user||!user.email){
        return respond({success:false,error:"Invalid or expired Google authentication session."},401);
      }

      const email=user.email.toLowerCase().trim();

      const {data:adminRecord}=await client
        .from("admin_users")
        .select("id,username")
        .or(`username.ilike.${email}`)
        .maybeSingle();

      const envAdmins=(Deno.env.get("ADMIN_EMAILS")||"")
        .split(",")
        .map((s:string)=>s.trim().toLowerCase())
        .filter(Boolean);

      const isDomainAuthorized=email.endsWith("@epsteinfoundation.org");
      const isAuthorized=Boolean(adminRecord)||envAdmins.includes(email)||isDomainAuthorized;

      if(!isAuthorized){
        return respond({
          success:false,
          error:`Access denied. Google account (${email}) is not an authorized administrator.`
        },403);
      }

      const adminUser=adminRecord?.username||email;
      return respond({
        success:true,
        token:await token(adminUser),
        username:adminUser,
        expiresIn:7200
      });
    }

    // Protected Admin Routes
    const who=await auth(req);
    if(!who)return reply({success:false,error:"Admin session expired. Sign in again."},401);

    if(req.method==="GET"&&action==="contributions"){
      const [priv,pub,settings]=await Promise.all([
        client.from("private_contributions").select("*").order("verified_at",{ascending:false}).limit(500),
        client.from("public_leaderboard").select("*").order("verified_at",{ascending:false}).limit(500),
        client.from("app_settings").select("btc_address,bsc_address").eq("id",1).single()
      ]);
      if(priv.error||pub.error)throw priv.error||pub.error;
      const allPriv=priv.data||[];
      const cmsRow=allPriv.find((r:any)=>r.tx_hash==="__cms_config__");
      const volunteers=allPriv.filter((r:any)=>r.tx_hash?.startsWith("vol_")||r.raw_payload?.record_type==="community_submission");
      const donations=allPriv.filter((r:any)=>r.tx_hash!=="__cms_config__"&&!r.tx_hash?.startsWith("vol_")&&r.raw_payload?.record_type!=="community_submission");
      return reply({
        success:true,
        private_contributions:donations,
        public_leaderboard:pub.data||[],
        volunteers,
        cms:cmsRow?.raw_payload||null,
        settings:settings.data
      });
    }

    // Save Homepage CMS Content Overrides
    if(req.method==="POST"&&action==="save-cms"){
      const b=await req.json();
      const cmsPayload={
        projectTitle:clean(b.projectTitle,100)||"Epstein Foundation",
        tagline:clean(b.tagline,120)||"For Children.",
        heroBadge:clean(b.heroBadge,80)||"Direct Community Support",
        bannerImage:clean(b.bannerImage,300)||"assets/banner.jpg",
        storyTitle:clean(b.storyTitle,140)||"Every Child Deserves a Fair Start.",
        storySubtitle:clean(b.storySubtitle,180)||"Direct, transparent community support—with zero middlemen.",
        storyParagraphs:Array.isArray(b.storyParagraphs)?b.storyParagraphs.map((x:unknown)=>clean(x,600)).filter(Boolean):[],
        announcement:{
          enabled:Boolean(b.announcement?.enabled),
          text:clean(b.announcement?.text,240)
        },
        campaignGoal:{
          enabled:Boolean(b.campaignGoal?.enabled),
          title:clean(b.campaignGoal?.title,100)||"Current Community Milestone",
          currentDisplay:clean(b.campaignGoal?.currentDisplay,100)||"",
          percentage:Math.min(100,Math.max(0,Number(b.campaignGoal?.percentage)||0))
        },
        social:{
          instagram:clean(b.social?.instagram,200)||"https://www.instagram.com/epsteinfoundationforchildren",
          x:clean(b.social?.x,200)||"https://x.com/epsteinfnd"
        },
        footerNotice:clean(b.footerNotice,240)||"Epstein Foundation — For Children. Direct community support with real-time on-chain verification.",
        copyright:clean(b.copyright,160)||"© 2026 Epstein Foundation. For Children."
      };
      const {error}=await client.from("private_contributions").upsert({
        tx_hash:"__cms_config__",
        network:"btc",
        recipient:"cms_config",
        sender:who.sub,
        amount_num:0.00000001,
        amount_display:"CMS",
        note:"Homepage CMS Configuration",
        raw_payload:cmsPayload
      },{onConflict:"tx_hash"});
      if(error)throw error;
      return reply({success:true,cms:cmsPayload});
    }

    // Add Manual Supporter / Donation Entry to Public Leaderboard
    if(req.method==="POST"&&action==="add-supporter"){
      const b=await req.json();
      const displayName=clean(b.displayName,60)||"Anonymous Supporter";
      const network=b.network==="BEP-20"?"BEP-20":"BTC";
      const amountDisplay=clean(b.amountDisplay,40)||"Verified Support";
      const amountNum=Math.max(0.00000001,Number(b.amountNum)||0.001);
      const note=clean(b.note,300);
      const txHash=clean(b.txHash,100)||("manual_"+Date.now()+"_"+crypto.randomUUID().slice(0,6));

      const {error:pubErr}=await client.from("public_leaderboard").insert({
        tx_hash:txHash,
        display_name:displayName,
        network,
        amount_display:amountDisplay,
        amount_num:amountNum,
        status:"verified"
      });
      if(pubErr)throw pubErr;

      await client.from("private_contributions").upsert({
        tx_hash:txHash,
        network:network==="BTC"?"btc":"bsc",
        recipient:"manual_admin_entry",
        sender:displayName,
        amount_num:amountNum,
        amount_display:amountDisplay,
        note:note||"Added manually by Admin",
        raw_payload:{manual:true,addedBy:who.sub}
      },{onConflict:"tx_hash"});

      return reply({success:true});
    }

    // Edit Public Leaderboard Entry (Supporter Name / Amount / Visibility)
    if(req.method==="POST"&&action==="edit-supporter"){
      const b=await req.json(),id=clean(b.id,80);
      if(!id)return reply({success:false,error:"Missing supporter ID."},400);
      const update:any={};
      if(b.displayName!==undefined)update.display_name=clean(b.displayName,60)||"Anonymous Supporter";
      if(b.amountDisplay!==undefined)update.amount_display=clean(b.amountDisplay,40);
      if(b.network==="BTC"||b.network==="BEP-20")update.network=b.network;
      const {error}=await client.from("public_leaderboard").update(update).eq("id",id);
      if(error)throw error;
      return reply({success:true});
    }

    // Delete or Mark Volunteer Submission
    if(req.method==="POST"&&action==="manage-volunteer"){
      const b=await req.json(),id=clean(b.id,80),mode=b.mode;
      if(!id)return reply({success:false,error:"Missing record ID."},400);
      if(mode==="delete"){
        const {error}=await client.from("private_contributions").delete().eq("id",id);
        if(error)throw error;
      }
      return reply({success:true});
    }

    // Change Admin Credentials
    if(req.method==="POST"&&action==="change-credentials"){
      const b=await req.json(),{data:u}=await client.from("admin_users").select("id,username,password_hash").eq("username",who.sub).single();
      if(!u||!(await checkPass(String(b.currentPassword||""),u.password_hash)))return reply({success:false,error:"Current password is incorrect."},403);
      const nextUser=clean(b.username,80)||u.username,nextPass=typeof b.password==="string"?b.password:"";
      if(nextPass&&nextPass.length<12)return reply({success:false,error:"New password must contain at least 12 characters."},400);
      const update:any={username:nextUser,updated_at:new Date().toISOString()};
      if(nextPass)update.password_hash=await hashPass(nextPass);
      const {error}=await client.from("admin_users").update(update).eq("id",u.id);
      if(error)throw error;
      return reply({success:true,token:await token(nextUser),username:nextUser});
    }

    // Update Wallet Receiving Addresses
    if(req.method==="POST"&&action==="update-settings"){
      const b=await req.json(),btc=clean(b.btc_address,100),bsc=clean(b.bsc_address,100);
      if(!/^([13]|bc1)[a-zA-HJ-NP-Z0-9]{20,90}$/.test(btc)||!/^0x[a-fA-F0-9]{40}$/.test(bsc))return reply({success:false,error:"Invalid receiving address format."},400);
      const {error}=await client.from("app_settings").update({btc_address:btc,bsc_address:bsc,updated_at:new Date().toISOString()}).eq("id",1);
      if(error)throw error;
      return reply({success:true});
    }

    // Moderate Leaderboard Entry (Hide / Restore / Delete)
    if(req.method==="POST"&&action==="moderate-entry"){
      const b=await req.json(),id=clean(b.id,80),mode=b.mode;
      if(!id||!["hide","restore","delete"].includes(mode))return reply({success:false,error:"Invalid moderation request."},400);
      let q=client.from("public_leaderboard").delete().eq("id",id);
      if(mode==="hide")q=client.from("public_leaderboard").update({status:"hidden"}).eq("id",id);
      if(mode==="restore")q=client.from("public_leaderboard").update({status:"verified"}).eq("id",id);
      const {error}=await q;
      if(error)throw error;
      return reply({success:true});
    }

    return reply({success:false,error:"Unknown operation."},404);
  }catch(e){
    console.error(e);
    return reply({success:false,error:"Admin API operation failed."},500);
  }
});
