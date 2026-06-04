const ABAS = [
  { id: 'produtos', label: 'Produtos', icon: '+', habilitado: true },
  { id: 'temas', label: 'Temas', icon: '🎨', habilitado: true },
  { id: 'agenda', label: 'Agenda', icon: '🗓️', habilitado: true },
  { id: 'datas', label: 'Datas', icon: '📅', habilitado: true },
  { id: 'logo', label: 'Sua Logo', icon: '©', habilitado: true },
  { id: 'empresa', label: 'Empresa', icon: '🏪', habilitado: true },
  { id: 'fontes', label: 'Fontes', icon: 'T', habilitado: true },
  { id: 'postar', label: 'Postar', icon: '💡', habilitado: true },
  { id: 'encarte', label: 'Encarte', icon: '✏️', habilitado: true },
];

export default function SidebarIcons({ ativa, aoMudar }) {
  return (
    <div className="sidebar-icons">
      {ABAS.map(a => (
        <button
          key={a.id}
          className={ativa === a.id ? 'active' : ''}
          onClick={() => a.habilitado && aoMudar(a.id)}
          disabled={!a.habilitado}
          title={a.habilitado ? a.label : `${a.label} (em breve)`}
        >
          <span className="icon">{a.icon}</span>
          <span>{a.label}</span>
        </button>
      ))}
    </div>
  );
}
