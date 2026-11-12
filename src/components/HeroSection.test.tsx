import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import HeroSection from './HeroSection';
import { rankFeed, ReaderProfile } from '@/lib/feedRanking';
afterEach(cleanup);
it('hero renders punctuation and preserves reader fallback details in its link',()=>{
 const article={id:'one',title:'&amp;#8216;A real story&#8217;',category:'culture',image:'https://example.test/story.jpg',externalLink:'https://publisher.test/story',excerpt:'Verified context.'};
 render(<MemoryRouter><HeroSection article={article}/></MemoryRouter>);
 expect(screen.getByRole('heading',{level:1}).textContent).toBe('‘A real story’');
 const href=screen.getByRole('link').getAttribute('href')!;
 const params=new URL(href,'https://example.test').searchParams;
 expect(params.get('title')).toBe('‘A real story’');
 expect(params.get('excerpt')).toBe('Verified context.');
});
it('different reader profiles render different relevant hero selections from the same API pool',()=>{
 const now=Date.now();
 const stories=[{id:'sport',title:'Sports report',category:'sports',image:'https://example.test/sport.jpg',date:new Date(now).toISOString()},
 {id:'tech',title:'Technology report',category:'tech',image:'https://example.test/tech.jpg',date:new Date(now).toISOString()}];
 const base:ReaderProfile={seed:'reader',interests:{},selectedTopics:[],read:{},impressions:{}};
 const sports=rankFeed(stories,{...base,interests:{sports:20}},now)[0];
 const technology=rankFeed(stories,{...base,seed:'another-reader',interests:{tech:20}},now)[0];
 const view=render(<MemoryRouter><HeroSection article={sports}/></MemoryRouter>);
 expect(screen.getByRole('heading',{level:1}).textContent).toBe('Sports report');
 view.rerender(<MemoryRouter><HeroSection article={technology}/></MemoryRouter>);
 expect(screen.getByRole('heading',{level:1}).textContent).toBe('Technology report');
});
