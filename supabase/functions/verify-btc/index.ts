import {db,reply,preflight,clean,limited} from "./_shared.ts";
Deno.serve(async(req)=>{const p=preflight(req);if(p)return p;if(req.method!=="POST")return reply({success:false,error:"Method not allowed"},405);
 try{const client=db();if(!await limited(client,req))return reply({success:false,error:"Too many attempts. Try again in 10 minutes."},429);
 const b=await req.json(),txid=clean(b.txid,64).toLowerCase();if(!/^[a-f0-9]{64}$/.test(txid))return reply({success:false,error:"Bitcoin TXID must be 64 hexadecimal characters."},400);
 const {data:s}=await client.from("app_settings").select("btc_address,btc_network").eq("id",1).single();if(!s)throw new Error("BTC settings unavailable");
 const {data:dupe}=await client.from("private_contributions").select("id").eq("tx_hash",txid).maybeSingle();if(dupe)return reply({success:false,error:"Transaction already verified."},409);
 const base=s.btc_network==="testnet"?"https://mempool.space/testnet/api":"https://mempool.space/api";
 const response=await fetch(base+"/tx/"+txid,{signal:AbortSignal.timeout(12000)});if(response.status===404)return reply({success:false,error:"Transaction not found."},404);if(!response.ok)throw new Error("Mempool API returned "+response.status);
 const tx=await response.json();let sats=0;for(const o of tx.vout||[])if((o.scriptpubkey_address||"").toLowerCase()===s.btc_address.toLowerCase())sats+=Number(o.value||0);
 if(!Number.isSafeInteger(sats)||sats<=0)return reply({success:false,error:"No positive output pays the configured BTC address."},422);
 const amount=sats/1e8,display=amount.toFixed(8)+" BTC",sender=(tx.vin||[]).map(v=>v.prevout?.scriptpubkey_address).filter(Boolean).join(", ").slice(0,1000)||null;
 const privateRow={tx_hash:txid,network:"btc",recipient:s.btc_address,sender,amount_num:amount,amount_display:display,note:clean(b.note)||null,raw_payload:{status:tx.status||{},vin:tx.vin||[],vout:tx.vout||[]}};
 const {error:pe}=await client.from("private_contributions").insert(privateRow);if(pe){if(pe.code==="23505")return reply({success:false,error:"Transaction already verified."},409);throw pe;}
 const {error:le}=await client.from("public_leaderboard").insert({tx_hash:txid,display_name:b.isAnonymous?"Anonymous Supporter":clean(b.displayName,50)||"Anonymous Supporter",network:"BTC",amount_display:display,amount_num:amount,status:"verified"});if(le)throw le;
 return reply({success:true,message:display+" verified and added to the leaderboard.",data:{txid,amountDisplay:display,confirmed:!!tx.status?.confirmed}});
 }catch(e){console.error(e);return reply({success:false,error:e instanceof Error?e.message:"BTC verification failed"},500);}});
