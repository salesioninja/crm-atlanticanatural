import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Sparkles, Package, DollarSign, Trash2, Edit, Tag, Check, Award, ShoppingBag } from 'lucide-react';
import { MOCK_PRODUCTS, MOCK_KITS } from '../constants';
import { Product, Kit } from '../types';
import Modal from './Modal';

export default function ServicosPage() {
  const [activeTab, setActiveTab] = useState<'produtos' | 'kits'>('produtos');
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS);
  const [kits, setKits] = useState<Kit[]>(MOCK_KITS);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    nome: '',
    linha: 'Nutracêuticos' as Product['linha'],
    preco_cliente: '',
    pontos_pv: '',
    descricao: '',
    beneficios: ''
  });

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.nome || !newProduct.preco_cliente) return;

    const clientePrice = parseFloat(newProduct.preco_cliente.replace('R$', '').replace(',', '.').trim()) || 0;
    const distPrice = clientePrice * 0.5; // 50% de desconto (100% de margem)
    const pv = parseInt(newProduct.pontos_pv) || Math.round(clientePrice * 0.35);

    const added: Product = {
      id: 'prod_' + Math.random().toString(36).substr(2, 7),
      nome: newProduct.nome,
      linha: newProduct.linha,
      preco_cliente: clientePrice,
      preco_distribuidor: distPrice,
      pontos_pv: pv,
      descricao: newProduct.descricao || 'Produto oficial Atlântica Natural.',
      beneficios: newProduct.beneficios || 'Alta performance e saúde natural.'
    };

    setProducts([added, ...products]);
    setNewProduct({
      nome: '',
      linha: 'Nutracêuticos',
      preco_cliente: '',
      pontos_pv: '',
      descricao: '',
      beneficios: ''
    });
    setIsAddModalOpen(false);
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Tem certeza que deseja remover este produto do catálogo?')) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Header com Abas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              Atlântica Natural 2026
            </span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Catálogo de Produtos & Kits</h2>
          <p className="text-xs text-white/50 mt-1">Margem de 100% de lucro na venda direta e ativações no plano de carreira.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor de Abas */}
          <div className="bg-white/5 border border-white/10 p-1 rounded-2xl flex">
            <button
              onClick={() => setActiveTab('produtos')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'produtos'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <Package size={14} />
              Produtos ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('kits')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'kits'
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <Award size={14} />
              Kits de Adesão ({kits.length})
            </button>
          </div>

          {activeTab === 'produtos' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all shrink-0"
            >
              <Plus size={16} />
              Novo Produto
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo Aba Produtos */}
      {activeTab === 'produtos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(prod => {
            const lucro = prod.preco_cliente - prod.preco_distribuidor;
            return (
              <motion.div
                key={prod.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-[28px] p-6 border-white/5 bg-slate-900/60 flex flex-col justify-between hover:border-emerald-500/30 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {prod.linha}
                    </span>
                    <span className="text-[11px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      {prod.pontos_pv} PV
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {prod.nome}
                  </h3>
                  <p className="text-xs text-white/50 mt-2 line-clamp-2 leading-relaxed">
                    {prod.beneficios || prod.descricao}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center bg-white/5 p-3 rounded-2xl">
                    <div>
                      <p className="text-[9px] text-white/40 font-bold uppercase">Preço Venda</p>
                      <p className="text-xs font-black text-white mt-0.5">R$ {prod.preco_cliente.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/40 font-bold uppercase">Custo (50%)</p>
                      <p className="text-xs font-bold text-white/70 mt-0.5">R$ {prod.preco_distribuidor.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-emerald-400 font-bold uppercase">Lucro (100%)</p>
                      <p className="text-xs font-black text-emerald-400 mt-0.5">R$ {lucro.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-white/30 flex items-center gap-1">
                      <ShoppingBag size={12} /> Pronta entrega
                    </span>
                    <button
                      onClick={() => handleDeleteProduct(prod.id)}
                      className="text-white/30 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Excluir produto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Conteúdo Aba Kits de Adesão */}
      {activeTab === 'kits' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kits.map(kit => (
            <motion.div
              key={kit.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass-card rounded-[28px] p-6 border transition-all flex flex-col justify-between ${
                kit.destaque
                  ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-slate-900 shadow-xl shadow-amber-500/10'
                  : 'border-white/5 bg-slate-900/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  {kit.destaque ? (
                    <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black">
                      Mais Recomendado
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg bg-white/5 text-white/60">
                      Plano Oficial
                    </span>
                  )}
                  <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                    {kit.pontos_pv} Pontos
                  </span>
                </div>

                <h3 className="text-lg font-black text-white">{kit.nome}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-2xl font-black text-emerald-400">R$ {kit.valor.toFixed(2)}</span>
                  <span className="text-xs text-white/40 ml-2">à vista ou parcelado</span>
                </div>

                <p className="text-xs text-white/70 font-semibold mb-2">{kit.itens_inclusos}</p>
                <p className="text-[11px] text-white/50 leading-relaxed">{kit.beneficios}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300">Retorno em Vendas:</span>
                  <span className="text-sm font-black text-emerald-400">R$ {kit.lucro_estimado.toFixed(2)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal Adicionar Novo Produto */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Cadastrar Produto no Catálogo">
        <form onSubmit={handleAddProduct} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-white/60 block mb-1">Nome do Produto</label>
            <input
              type="text"
              required
              placeholder="Ex: Cloreto de Magnésio PA 120 Cápsulas"
              value={newProduct.nome}
              onChange={e => setNewProduct({ ...newProduct, nome: e.target.value })}
              className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-white/60 block mb-1">Linha</label>
              <select
                value={newProduct.linha}
                onChange={e => setNewProduct({ ...newProduct, linha: e.target.value as any })}
                className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="Nutracêuticos">Nutracêuticos</option>
                <option value="Linha Ozônio">Linha Ozônio</option>
                <option value="Chás Funcionais">Chás Funcionais</option>
                <option value="Perfumaria Fina">Perfumaria Fina</option>
                <option value="Cosméticos">Cosméticos</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-white/60 block mb-1">Preço Venda (R$)</label>
              <input
                type="text"
                required
                placeholder="Ex: 119.98"
                value={newProduct.preco_cliente}
                onChange={e => setNewProduct({ ...newProduct, preco_cliente: e.target.value })}
                className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-white/60 block mb-1">Pontos (PV)</label>
            <input
              type="number"
              placeholder="Ex: 40"
              value={newProduct.pontos_pv}
              onChange={e => setNewProduct({ ...newProduct, pontos_pv: e.target.value })}
              className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-white/60 block mb-1">Benefícios Terapêuticos / Descrição</label>
            <textarea
              rows={3}
              placeholder="Indicações, ação no organismo e modo de usar..."
              value={newProduct.beneficios}
              onChange={e => setNewProduct({ ...newProduct, beneficios: e.target.value })}
              className="w-full bg-slate-800/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white/60 hover:text-white hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20"
            >
              Salvar Produto
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
