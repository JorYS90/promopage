import { useEffect, useState } from 'react';

// Painel "Encarte": metadados do projeto — nome, observações, categoria.
// Permite ao usuário organizar e classificar campanhas pra medir resultados depois.
// Os dados ficam em props (state do App) e são persistidos no projeto ao salvar.

export default function PainelEncarte({
  nomeProjeto,
  setNomeProjeto,
  observacoes = '',
  setObservacoes,
  categoria = '',
  setCategoria,
}) {
  // Categorias disponíveis (vêm do backend — gerenciadas em "Temas")
  const [categorias, setCategorias] = useState([]);

  useEffect(() => {
    fetch('/api/categorias')
      .then(r => r.ok ? r.json() : [])
      .then(lista => {
        // Backend retorna objetos {nome, criadoEm, padrao} — normaliza pra string
        const nomes = Array.isArray(lista)
          ? lista.map(c => typeof c === 'string' ? c : (c?.nome || '')).filter(Boolean)
          : [];
        setCategorias(nomes);
      })
      .catch(() => setCategorias([]));
  }, []);

  return (
    <div className="painel painel-encarte">
      <h3 className="pe-titulo">Nome e Anotações</h3>
      <p className="pe-intro">
        Dê um nome e anote observações sobre este encarte, para no futuro
        poder medir os resultados que você obteve.
      </p>

      <div className="pe-campo">
        <label className="pe-label">Nome do Encarte</label>
        <input
          type="text"
          className="pe-input"
          value={nomeProjeto || ''}
          onChange={e => setNomeProjeto(e.target.value)}
          placeholder="Ex: Promoção Dia das Mães"
          maxLength={120}
        />
      </div>

      <div className="pe-campo">
        <label className="pe-label">Observações</label>
        <textarea
          className="pe-textarea"
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          placeholder="Notas internas: público-alvo, canal de divulgação, resultado esperado..."
          rows={5}
          maxLength={1000}
        />
        {observacoes.length > 0 && (
          <div className="pe-contador">{observacoes.length} / 1000</div>
        )}
      </div>

      <div className="pe-campo">
        <label className="pe-label">Categoria</label>
        <select
          className="pe-select"
          value={categoria || ''}
          onChange={e => setCategoria(e.target.value)}
        >
          <option value="">Sem Categoria</option>
          {categorias.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="pe-dica">
        💡 <b>Dica:</b> Os dados ficam salvos no projeto quando você clica em
        <b> 💾 Salvar</b>. Use observações pra registrar performance e ideias
        pra próximas campanhas.
      </div>
    </div>
  );
}
