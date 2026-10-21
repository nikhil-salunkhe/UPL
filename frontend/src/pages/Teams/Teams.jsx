import { useEffect, useState } from 'react';
import { getTeams } from '../../services/teamService';
import { getPlayers } from '../../services/playerService';
import TeamCard from '../../components/TeamCard/TeamCard';
import './Teams.css';

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const [teamData, playerData] = await Promise.all([getTeams({ page, limit: 24 }), getPlayers()]);
        setTeams(teamData.data || []);
        setPagination(teamData.pagination || null);
        setPlayers(playerData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [page]);

  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > (pagination?.totalPages || 1)) return;
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="page-shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Team Rosters</p>
          <h1>Teams</h1>
        </div>
      </section>

      {loading ? (
        <div className="status-card">Loading teams...</div>
      ) : teams.length === 0 ? (
        <div className="status-card">No teams created yet.</div>
      ) : (
        <>
          <div className="teams-grid">
            {teams.map((team) => (
              <TeamCard key={team._id} team={team} players={players} />
            ))}
          </div>

          {pagination && (
            <div className="pagination-controls">
              <button
                onClick={() => goToPage(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                ← Prev
              </button>
              <span className="page-info">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} teams)
              </span>
              <button
                onClick={() => goToPage(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Teams;
