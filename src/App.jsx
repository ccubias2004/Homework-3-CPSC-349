import React, { useEffect, useState } from 'react';
const API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';
const API_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
function MovieControls({ searchInput, sortOrder, onSearch, onSort, onSubmit }) {
  return (
    <form className="controls" role="search" onSubmit={onSubmit}>
      <label htmlFor="search-input" className="visually-hidden">Search for a movie</label>
      <input id="search-input" type="search" placeholder="Search for a movie..."
        autoComplete="off" value={searchInput} onChange={(event) => onSearch(event.target.value)} />
      <label htmlFor="sort-select" className="visually-hidden">Sort movies</label>
      <select id="sort-select" value={sortOrder} onChange={(event) => onSort(event.target.value)}>
        <option value="">Sort By</option>
        <option value="release-asc">Release Date (Ascending)</option>
        <option value="release-desc">Release Date (Descending)</option>
        <option value="rating-asc">Rating (Ascending)</option>
        <option value="rating-desc">Rating (Descending)</option>
      </select>
    </form>
  );
}
function MovieCard({ movie }) {
  const [posterFailed, setPosterFailed] = useState(false);
  const title = movie.title || movie.original_title || 'Untitled movie';
  return (
    <article className="movie-card">
      {movie.poster_path && !posterFailed ? (
        <img className="movie-poster" src={IMAGE_BASE_URL + movie.poster_path}
          alt={`${title} poster`} loading="lazy" width="200" height="300"
          onError={() => setPosterFailed(true)} />
      ) : (
        <div className="poster-placeholder" role="img" aria-label={`No poster available for ${title}`}>
          No poster available
        </div>
      )}
      <h2>{title}</h2>
      <p>Release Date: {movie.release_date || 'N/A'}</p>
      <p>Rating: {Number.isFinite(movie.vote_average) ? movie.vote_average : 'N/A'}</p>
    </article>
  );
}
function Pagination({ page, totalPages, disabled, onPageChange }) {
  return (
    <nav className="pagination" aria-label="Movie pages">
      <button type="button" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      <span aria-live="polite">Page {page} of {totalPages}</span>
      <button type="button" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </nav>
  );
}
function sortMovies(movies, sortOrder) {
  if (!sortOrder) return movies;
  const direction = sortOrder.endsWith('asc') ? 1 : -1;
  const byRelease = sortOrder.startsWith('release');
  return [...movies].sort((a, b) => {
    const first = byRelease ? a.release_date : a.vote_average;
    const second = byRelease ? b.release_date : b.vote_average;
    const firstMissing = byRelease ? !first : !Number.isFinite(first);
    const secondMissing = byRelease ? !second : !Number.isFinite(second);
    if (firstMissing && secondMissing) return 0;
    if (firstMissing) return 1;
    if (secondMissing) return -1;
    return (byRelease ? first.localeCompare(second) : first - second) * direction;
  });
}
export default function App() {
  const [searchInput, setSearchInput] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [movies, setMovies] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('Loading movies...');
  const [request, setRequest] = useState({ query: '', page: 1, delay: 0 });
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        if (!API_KEY.trim() || API_KEY === 'YOUR_TMDB_API_KEY') {
          throw new Error('Add your TMDB API key to .env.local, then restart the development server.');
        }
        const endpoint = request.query ? '/search/movie' : '/movie/popular';
        const url = new URL(API_BASE_URL + endpoint);
        url.searchParams.set('api_key', API_KEY);
        url.searchParams.set('language', 'en-US');
        url.searchParams.set('page', String(request.page));
        if (request.query) {
          url.searchParams.set('query', request.query);
          url.searchParams.set('include_adult', 'false');
        }
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error('TMDB rejected the API key. Check .env.local, then restart the server.');
          }
          if (response.status === 429) {
            throw new Error('Too many requests. Wait a moment, then try searching again.');
          }
          throw new Error(`Unable to load movies (HTTP ${response.status}). Please try again.`);
        }
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!Array.isArray(data.results) || !Number.isFinite(data.total_pages)) {
          throw new Error('TMDB returned an unexpected response. Please try again.');
        }
        const results = data.results.slice(0, 20);
        setMovies(results);
        setTotalPages(Math.max(1, Math.min(data.total_pages, 500)));
        setMessage(results.length ? '' : 'No movies found. Try a different title.');
      } catch (error) {
        if (controller.signal.aborted) return;
        setMovies([]);
        setTotalPages(1);
        setMessage(error instanceof TypeError
          ? 'Could not connect to TMDB. Check your internet connection, then reload or try another search.'
          : error.message);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, request.delay);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [request]);
  function loadMovies(query, page, delay = 0) {
    setMovies([]);
    setIsLoading(true);
    setMessage('Loading movies...');
    setRequest({ query, page, delay });
  }
  function handleSearch(value) {
    setSearchInput(value);
    setTotalPages(1);
    loadMovies(value.trim(), 1, 300);
  }
  function handleSubmit(event) {
    event.preventDefault();
    setTotalPages(1);
    loadMovies(searchInput.trim(), 1);
  }
  const displayedMovies = sortMovies(movies, sortOrder);
  const displayedPage = !isLoading && movies.length === 0 ? 1 : request.page;
  return (
    <>
      <header><h1>Movie Explorer</h1></header>
      <main>
        <MovieControls searchInput={searchInput} sortOrder={sortOrder}
          onSearch={handleSearch} onSort={setSortOrder} onSubmit={handleSubmit} />
        <p className="status-message" role="status" aria-live="polite" hidden={!message}>{message}</p>
        <section className="movie-container" aria-label="Movies" aria-busy={isLoading}>
          {displayedMovies.map((movie) => <MovieCard key={movie.id} movie={movie} />)}
        </section>
        <Pagination page={displayedPage} totalPages={totalPages}
          disabled={isLoading || movies.length === 0}
          onPageChange={(page) => loadMovies(request.query, page)} />
      </main>
      <footer><small>This product uses the TMDB API but is not endorsed or certified by TMDB.</small></footer>
    </>
  );
}
