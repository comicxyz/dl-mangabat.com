import axios, { AxiosResponse } from 'axios';
import dayjs from 'dayjs';
import { decode } from 'html-entities';
import { parse, HTMLElement } from 'node-html-parser';
import ProcessTitleFunctionInterface from '../../@types/ProcessTitleFunctionInterface.js';
import parseVolumeFromString from '../../utils/parseVolumeFromString.js';
import ComicInfoXml from '../../@types/ComicInfoXml.js';

export function getSeriesTitle(parsedHtml: HTMLElement): string {
  const title = parsedHtml.querySelector('#manga-title h1');
  if (title) {
    return title.innerText.trim();
  }
  throw new Error('Series title cannot be found.');
}

export function getSummary(parsedHtml: HTMLElement): string | undefined {
  const h5s = parsedHtml.querySelectorAll('h5');
  let summary;
  if (h5s.length) {
    const summaryEl = h5s.filter((el) => el.innerText.trim().toLowerCase() === 'summary');
    summary = summaryEl[0].parentNode.innerText.trim();
  }
  return summary;
}

export function getAuthor(parsedHtml: HTMLElement): string | undefined {
  const authorEl = parsedHtml.querySelector('.author-content');
  let author;
  if (authorEl) {
    const anchorsAuthor = authorEl.querySelectorAll('a');
    if (anchorsAuthor.length) {
      author = decode(anchorsAuthor.map((el) => el.innerText).join(', '));
    }
  }
  return author;
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
  let communityRating = 0;
  const communityRatingEl = parsedHtml.querySelector('#averagerate')?.innerText.trim() || '0';
  communityRating = Number.isNaN(Number(communityRatingEl)) ? 0 : Number(communityRatingEl);
  communityRating = Math.round(communityRating);
  return communityRating;
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
  const anchors = parsedHtml.querySelectorAll('a');

  return anchors.filter((a) => {
    const classes = a.parentNode.getAttribute('class');
    return classes?.includes('wp-manga-chapter');
  }).map((a) => {
    const chapterUrlFromAnchor = a.getAttribute('href');
    const title = a.innerText.trim();
    const releaseDate = a.parentNode.querySelector('.chapter-release-date')?.innerText.trim() || '';

    let releaseDateObj;
    if (releaseDate) {
      releaseDateObj = (releaseDate.includes(' ago') ? dayjs() : dayjs(releaseDate));
    }

    const parsed = parseVolumeFromString(title, seriesTitle);
    const { volume, isSpecial } = parsed;

    return {
      title,
      url: chapterUrlFromAnchor,
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

  const chapterUrl = `${url}ajax/chapters/`;
  const chaptersAjax = await axios.post(chapterUrl).then((resp) => resp.data);
  const parsedChaptersFromAjax = parse(chaptersAjax);

  const chapters = getChapters(parsedChaptersFromAjax, seriesTitle).map((chapter) => (
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
