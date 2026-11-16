import {db,reply,preflight} from "./_shared.ts";
Deno.serve(async(req)=>{const p=preflight(req);if(p)return p;if(req.method!=="GET")return reply({success:false,error:"Method not allowed"},405);
 try{const {data,error}=await db().from("app_settings").select("btc_address,bsc_address,btc_network").eq("id",1).single();if(error||!data)throw error||new Error("Settings missing");
 return reply({success:true,data:{btc:{address:data.btc_address,network:data.btc_network,qrUri:"bitcoin:"+data.btc_address},bsc:{address:data.bsc_address,chainId:56,qrUri:"ethereum:"+data.bsc_address+"@56"}}});
 }catch(e){console.error(e);return reply({success:false,error:"Unable to load public configuration"},500);}});
