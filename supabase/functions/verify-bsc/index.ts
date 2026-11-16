import {db,reply,preflight,clean,limited} from "./_shared.ts";
const TRANSFER="0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
async function rpc(url:string,method:string,params:unknown[]){const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error("BSC RPC HTTP "+r.status);const j=await r.json();if(j.error)throw new Error(j.error.message||"BSC RPC error");return j.result;}
Deno.serve(async(req)=>{const p=preflight(req);if(p)return p;if(req.method!=="POST")return reply({success:false,error:"Method not allowed"},405);
 try{const client=db();if(!await limited(client,req))return reply({success:false,error:"Too many attempts. Try again in 10 minutes."},429);
 const b=await req.json(),hash=clean(b.txHash,66);if(!/^0x[a-fA-F0-9]{64}$/.test(hash))return reply({success:false,error:"BSC hash must be 0x plus 64 hexadecimal characters."},400);
 const {data:s}=await client.from("app_settings").select("bsc_address,bsc_rpc_url").eq("id",1).single();if(!s)throw new Error("BSC settings unavailable");
 const {data:dupe}=await client.from("private_contributions").select("id").eq("tx_hash",hash.toLowerCase()).maybeSingle();if(dupe)return reply({success:false,error:"Transaction already verified."},409);
 const [tx,receipt]=await Promise.all([rpc(s.bsc_rpc_url,"eth_getTransactionByHash",[hash]),rpc(s.bsc_rpc_url,"eth_getTransactionReceipt",[hash])]);if(!tx||!receipt)return reply({success:false,error:"Transaction not found on BNB Smart Chain."},404);if(receipt.status!=="0x1")return reply({success:false,error:"Transaction failed or reverted."},422);
 let amount=0,display="",tokenContract=null;const target=s.bsc_address.toLowerCase();
 if(tx.to?.toLowerCase()===target&&BigInt(tx.value||"0x0")>0n){amount=Number(BigInt(tx.value))/1e18;display=amount.toFixed(6)+" BNB";}
 else {for(const log of receipt.logs||[]){if(log.topics?.[0]===TRANSFER&&log.topics.length>=3&&("0x"+log.topics[2].slice(-40)).toLowerCase()===target){const raw=BigInt(log.data||"0x0"),contract=log.address;const d=await rpc(s.bsc_rpc_url,"eth_call",[{to:contract,data:"0x313ce567"},"latest"]).catch(()=>"0x12");const decimals=Math.min(36,Number(BigInt(d||"0x12")));amount=Number(raw)/Math.pow(10,decimals);display=amount.toFixed(4)+" BEP-20";tokenContract=contract;break;}}}
 if(!(amount>0)||!Number.isFinite(amount))return reply({success:false,error:"No positive BNB or BEP-20 transfer to the configured address was found."},422);
 const txh=hash.toLowerCase(),privateRow={tx_hash:txh,network:"bsc",recipient:s.bsc_address,sender:tx.from||null,amount_num:amount,amount_display:display,note:clean(b.note)||null,raw_payload:{transaction:tx,receipt,token_contract:tokenContract}};
 const {error:pe}=await client.from("private_contributions").insert(privateRow);if(pe){if(pe.code==="23505")return reply({success:false,error:"Transaction already verified."},409);throw pe;}
 const {error:le}=await client.from("public_leaderboard").insert({tx_hash:txh,display_name:b.isAnonymous?"Anonymous Supporter":clean(b.displayName,50)||"Anonymous Supporter",network:"BEP-20",amount_display:display,amount_num:amount,status:"verified"});if(le)throw le;
 return reply({success:true,message:display+" verified and added to the leaderboard.",data:{txHash:hash,amountDisplay:display}});
 }catch(e){console.error(e);return reply({success:false,error:e instanceof Error?e.message:"BSC verification failed"},500);}});
