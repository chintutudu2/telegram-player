/**
 * Attribution required by TMDB's API terms. Rendered only when a TMDB key
 * is configured (see AppShell).
 */
export function TmdbCredit() {
  return (
    <p className="text-xs leading-relaxed text-muted/70">
      Movie data from{" "}
      <a
        href="https://www.themoviedb.org"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-muted underline-offset-2 hover:text-accent hover:underline"
      >
        TMDB
      </a>
      . This product uses the TMDB API but is not endorsed or certified by TMDB.
    </p>
  );
}
