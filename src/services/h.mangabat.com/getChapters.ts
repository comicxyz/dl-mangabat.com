import axios, { AxiosResponse } from 'axios';
import dayjs from 'dayjs';
import { decode } from 'html-entities';
import { parse, HTMLElement } from 'node-html-parser';
import parseVolumeFromString from '../../utils/parseVolumeFromString.js';
import ProcessTitleFunctionInterface from '../../@types/ProcessTitleFunctionInterface.js';
import ComicInfoXml from '../../@types/ComicInfoXml.js';

export function getSeriesTitle(parsedHtml: HTMLElement): string {
  const title = parsedHtml.querySelector('.story-info-right h1');
  if (title) {
    return title.innerText.trim();
  }
  else {
    const meta = parsedHtml.querySelector('meta[property="og:title"]');
    if (meta) {
        if(meta.attributes.content.includes('|')){
            return meta.attributes.content.split('|')[0].trim();
        }
        return meta.attributes.content;
    }
}
  throw new Error('Series title cannot be found.');
}

export function getSummary(parsedHtml: HTMLElement): string | undefined {
  const summary = parsedHtml.querySelector('#panel-story-info-description');
  return summary?.innerText.trim() || undefined;
}

export function getAuthor(parsedHtml: HTMLElement): string | undefined {
  const td = parsedHtml.querySelectorAll('.variations-tableInfo td');
  if (td[3]) return td[3].innerText.trim();
  return undefined;
}

export function getGenre(parsedHtml: HTMLElement): string | undefined {
  const genreEl = parsedHtml.querySelector('.genres-content');
  let genres;
  if (genreEl) {
    const anchorsGenre: HTMLElement[] = genreEl.querySelectorAll('a');
    if (anchorsGenre.length) {
      genres = decode(anchorsGenre.map((el) => el.innerText).join(', '));
    }
  }
  return genres;
}

export function getCommunityRating(parsedHtml: HTMLElement): number | undefined {
  const javascript = parsedHtml.querySelectorAll('script');
  const rating = javascript.filter((j) => j.innerText.includes('rating')).map((j) => j.innerText.trim())[0];
  if (rating) {
    return Number.parseInt(
      rating
        .split('\n')
        .filter((str) => str.includes('rating'))[0]
        .split('=')[1].replace(/[^\d.-]+/g, ''),
      10,
    );
  } return 0;
}

export function getChapters(parsedHtml: HTMLElement, seriesTitle?: string):
{
  title: string,
  url?: string,
  isSpecial: boolean,
  volume: number,
  year?: number,
  month?: number,
  day?: number }[] {
  const chapterContainers = parsedHtml.querySelectorAll('li.a-h');

  return chapterContainers
    .filter((container) => {
      const anchor = container.querySelector('a');
      return !!anchor;
    })
    .map((container) => {
      const anchor = container.querySelector('a');
      const title = anchor?.innerText.trim() || '';
      const url = anchor?.attributes.href;
      const { volume, isSpecial } = parseVolumeFromString(title);

      const releaseDate = container.querySelector('.chapter-time')?.attributes.title || '';

      let releaseDateObj;
      if (releaseDate) {
        releaseDateObj = (releaseDate.includes(' ago') ? dayjs() : dayjs(releaseDate));
      }

      return {
        title,
        url,
        isSpecial: isSpecial || false,
        volume: volume || -1,
        year: releaseDateObj?.get('year'),
        month: releaseDateObj ? releaseDateObj.month() + 1 : undefined,
        day: releaseDateObj?.date(),
      };
    });
}

const processTitle: ProcessTitleFunctionInterface = async (url: string, category?: string) => {
  const axiosResponse: AxiosResponse = await axios.get(url);
  const parsedHtml = parse(axiosResponse.data as string);

  const seriesTitle = getSeriesTitle(parsedHtml);

  const summary = getSummary(parsedHtml);

  const author = getAuthor(parsedHtml);

  const communityRating = getCommunityRating(parsedHtml);

  const genre = getGenre(parsedHtml);

  const chapters = getChapters(parsedHtml, seriesTitle).map((chapter) => (
    {
      url: chapter.url || '',
      title: chapter.title,
      seriesTitle,
      seriesUrl: url,
      category,
      comicInfoXml: new ComicInfoXml({
        Series: decode(seriesTitle),
        Title: decode(chapter.title),
        Summary: summary,
        Volume: chapter.volume,
        Web: url,
        Year: chapter.year,
        Month: chapter.month,
        Day: chapter.day,
        Format: chapter.isSpecial ? 'Specials' : undefined,
        Author: author,
        Genre: genre,
        CommunityRating: communityRating,
      }),
    }));

  chapters.reverse();

  if (chapters.length > 0) {
    return {
      title: seriesTitle,
      url,
      chapters,
    };
  }

  throw new Error('No chapters found');
};

export default processTitle;
