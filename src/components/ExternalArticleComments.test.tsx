import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ExternalArticleComments from './ExternalArticleComments';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('requests a trusted community prompt on article view, then displays the saved bot comment',async()=>{
 let generated=false;
 const fetch=vi.fn(async(_url:string,options?:RequestInit)=>{
  if(options?.method==='POST'){
   const body=JSON.parse(String(options.body));
   expect(body).toEqual({action:'ensure-community-prompt',articleId:'rss-7',articleUrl:'https://example.test/story'});
   expect(body.content).toBeUndefined();
   generated=true;
   return {ok:true,json:async()=>({created:1})};
  }
  return {ok:true,json:async()=>generated?[{id:'external-7',articleId:'rss-7',author:'RealSSA Community Bot 🤖',content:'What could free access mean for residents?',date:new Date().toISOString(),likes:0,isBot:true,replies:[]}]:[]};
 });
 vi.stubGlobal('fetch',fetch);
 render(<ExternalArticleComments articleId="rss-7" articleTitle="Library opens" articleUrl="https://example.test/story" />);
 await waitFor(()=>expect(screen.getByText('What could free access mean for residents?')).toBeTruthy());
 expect(fetch.mock.calls.some(([,options])=>options?.method==='POST')).toBe(true);
});
