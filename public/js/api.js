/**
 * AniList GraphQL API Client
 */
window.AniApi = (function () {
  'use strict';

  const GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

  async function request(query, variables = {}, token = null) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables })
    });

    const data = await response.json();

    if (data.errors && data.errors.length) {
      const err = new Error(data.errors[0].message || 'AniList API Error');
      err.errors = data.errors;
      err.status = data.errors[0].status;
      throw err;
    }

    return data.data;
  }

  // Fetch logged in viewer info
  async function fetchViewer(token) {
    const query = `
      query {
        Viewer {
          id
          name
          avatar { large medium }
          bannerImage
          options {
            titleLanguage
            displayAdultContent
          }
          mediaListOptions {
            scoreFormat
          }
        }
      }
    `;
    const data = await request(query, {}, token);
    return data.Viewer;
  }

  // Fetch full user collection (Anime or Manga) with multi-chunk pagination
  async function fetchUserCollection({ userId, username, type = 'ANIME', token = null }) {
    const query = `
      query ($userId: Int, $userName: String, $type: MediaType, $chunk: Int) {
        MediaListCollection(userId: $userId, userName: $userName, type: $type, chunk: $chunk) {
          hasNextChunk
          lists {
            name
            isCustomList
            status
            entries {
              id
              score(raw: false)
              progress
              progressVolumes
              repeat
              notes
              private
              status
              updatedAt
              media {
                id
                idMal
                title { romaji english native }
                coverImage { extraLarge large medium color }
                bannerImage
                averageScore
                meanScore
                popularity
                format
                status
                episodes
                chapters
                volumes
                genres
                duration
                season
                seasonYear
                description(asHtml: false)
                type
                isFavourite
              }
            }
          }
        }
        User(id: $userId, name: $userName) {
          id
          name
          avatar { large medium }
          bannerImage
          statistics {
            anime { count minutesWatched meanScore episodesWatched }
            manga { count chaptersRead meanScore volumesRead }
          }
        }
      }
    `;

    const vars = { type, chunk: 1 };
    if (userId) vars.userId = Number(userId);
    if (username) vars.userName = username.trim();

    const firstData = await request(query, vars, token);
    const user = firstData.User;
    let allLists = firstData.MediaListCollection?.lists || [];
    let hasNext = firstData.MediaListCollection?.hasNextChunk;
    let currentChunk = 1;

    // Retrieve additional chunks if collection has > 500 entries
    while (hasNext && currentChunk < 8) {
      currentChunk++;
      vars.chunk = currentChunk;
      try {
        const nextData = await request(query, vars, token);
        const nextLists = nextData.MediaListCollection?.lists || [];
        hasNext = nextData.MediaListCollection?.hasNextChunk;

        nextLists.forEach(nList => {
          const existing = allLists.find(l => l.name === nList.name);
          if (existing) {
            existing.entries = (existing.entries || []).concat(nList.entries || []);
          } else {
            allLists.push(nList);
          }
        });
      } catch (chunkErr) {
        console.warn('Chunk fetch stopped:', chunkErr);
        break;
      }
    }

    return {
      user,
      collection: { lists: allLists }
    };
  }

  // Fetch preset lists (Top Anime, Trending, Popular Manga)
  async function fetchPresetMedia(category = 'POPULAR', type = 'ANIME', perPage = 30) {
    let sort = ['POPULARITY_DESC'];
    if (category === 'TRENDING') sort = ['TRENDING_DESC'];
    if (category === 'TOP_RATED') sort = ['SCORE_DESC'];

    const query = `
      query ($page: Int, $perPage: Int, $type: MediaType, $sort: [MediaSort]) {
        Page(page: $page, perPage: $perPage) {
          media(type: $type, sort: $sort) {
            id
            title { romaji english native }
            coverImage { extraLarge large color }
            bannerImage
            averageScore
            meanScore
            popularity
            format
            episodes
            chapters
            genres
            seasonYear
            status
            type
          }
        }
      }
    `;

    const data = await request(query, { page: 1, perPage, type, sort });
    return data.Page?.media || [];
  }

  // Fetch browse/explorer list with genre and category filters
  async function fetchBrowseList({ category = 'TRENDING', type = 'ANIME', page = 1, perPage = 28, genre = 'ALL' }) {
    let sort = ['TRENDING_DESC'];
    if (category === 'POPULAR') sort = ['POPULARITY_DESC'];
    if (category === 'TOP_RATED') sort = ['SCORE_DESC'];
    if (category === 'NEWEST') sort = ['START_DATE_DESC'];

    const query = `
      query ($page: Int, $perPage: Int, $type: MediaType, $sort: [MediaSort], $genre: String) {
        Page(page: $page, perPage: $perPage) {
          media(type: $type, sort: $sort, genre: $genre) {
            id
            title { romaji english native }
            coverImage { extraLarge large color }
            bannerImage
            averageScore
            popularity
            format
            episodes
            chapters
            genres
            seasonYear
            status
            type
            description(asHtml: false)
          }
        }
      }
    `;

    const vars = { page, perPage, type, sort };
    if (genre && genre !== 'ALL') vars.genre = genre;

    const data = await request(query, vars);
    return data.Page?.media || [];
  }

  // Search Media with rich fields
  async function searchMedia(search, type = 'ANIME', page = 1, perPage = 12) {
    const query = `
      query ($search: String, $type: MediaType, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { total hasNextPage }
          media(search: $search, type: $type, sort: [POPULARITY_DESC]) {
            id
            title { romaji english native }
            coverImage { extraLarge large color }
            bannerImage
            averageScore
            popularity
            format
            episodes
            chapters
            genres
            seasonYear
            status
            type
            description(asHtml: false)
          }
        }
      }
    `;
    const data = await request(query, { search, type, page, perPage });
    return data.Page?.media || [];
  }

  // Fetch full details of single media (for rich modal)
  async function fetchMediaDetails(mediaId, token = null) {
    const query = `
      query ($id: Int) {
        Media(id: $id) {
          id
          idMal
          title { romaji english native }
          coverImage { extraLarge large color }
          bannerImage
          averageScore
          meanScore
          popularity
          favourites
          format
          status
          episodes
          chapters
          volumes
          duration
          season
          seasonYear
          description(asHtml: false)
          genres
          tags { id name rank isMediaSpoiler }
          studios(isMain: true) { nodes { id name siteUrl } }
          trailer { id site thumbnail }
          nextAiringEpisode { episode timeUntilAiring }
          type
          isFavourite
          mediaListEntry {
            id
            status
            score(raw: false)
            progress
            progressVolumes
            notes
            repeat
            private
          }
        }
      }
    `;
    const data = await request(query, { id: Number(mediaId) }, token);
    return data.Media;
  }

  // Mutation: Save / Update entry in AniList
  async function saveMediaListEntry(entry, token) {
    if (!token) throw new Error('AniList token required to save list changes');

    const query = `
      mutation (
        $mediaId: Int,
        $status: MediaListStatus,
        $score: Float,
        $progress: Int,
        $progressVolumes: Int,
        $repeat: Int,
        $notes: String,
        $private: Boolean
      ) {
        SaveMediaListEntry(
          mediaId: $mediaId,
          status: $status,
          score: $score,
          progress: $progress,
          progressVolumes: $progressVolumes,
          repeat: $repeat,
          notes: $notes,
          private: $private
        ) {
          id
          mediaId
          status
          score
          progress
          repeat
          notes
          private
          updatedAt
        }
      }
    `;

    const vars = {
      mediaId: Number(entry.mediaId),
      status: entry.status || 'CURRENT',
      score: typeof entry.score === 'number' ? entry.score : (parseFloat(entry.score) || 0),
      progress: parseInt(entry.progress, 10) || 0,
      notes: entry.notes || '',
      private: !!entry.private
    };

    if (entry.repeat !== undefined) vars.repeat = parseInt(entry.repeat, 10) || 0;
    if (entry.progressVolumes !== undefined) vars.progressVolumes = parseInt(entry.progressVolumes, 10) || 0;

    const data = await request(query, vars, token);
    return data.SaveMediaListEntry;
  }

  // Mutation: Delete entry from AniList
  async function deleteMediaListEntry(entryId, token) {
    if (!token) throw new Error('AniList token required');
    const query = `
      mutation ($id: Int) {
        DeleteMediaListEntry(id: $id) {
          deleted
        }
      }
    `;
    const data = await request(query, { id: Number(entryId) }, token);
    return data.DeleteMediaListEntry?.deleted;
  }

  // Mutation: Toggle Favourite
  async function toggleFavourite({ animeId, mangaId }, token) {
    if (!token) throw new Error('AniList token required');
    const query = `
      mutation ($animeId: Int, $mangaId: Int) {
        ToggleFavourite(animeId: $animeId, mangaId: $mangaId) {
          anime { nodes { id } }
          manga { nodes { id } }
        }
      }
    `;
    const vars = {};
    if (animeId) vars.animeId = Number(animeId);
    if (mangaId) vars.mangaId = Number(mangaId);

    const data = await request(query, vars, token);
    return data.ToggleFavourite;
  }

  return {
    request,
    fetchViewer,
    fetchUserCollection,
    fetchPresetMedia,
    fetchBrowseList,
    searchMedia,
    fetchMediaDetails,
    saveMediaListEntry,
    deleteMediaListEntry,
    toggleFavourite
  };
})();
