import React, { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { Service, Professional, ProfessionalService } from '@/types'
import {
  CalendarDays,
  Plus,
  Clock,
  DollarSign,
  Edit2,
  Trash2,
  Users,
  CheckCircle2,
  XCircle,
  Tag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

const SERVICE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#64748b']

export const Servicos: React.FC = () => {
  const { organization } = useAuth()
  const orgId = organization?.id

  const [services, setServices] = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [profServices, setProfServices] = useState<ProfessionalService[]>([])
  const [loading, setLoading] = useState(true)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(45)
  const [price, setPrice] = useState(150)
  const [color, setColor] = useState('#10b981')
  const [category, setCategory] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [servsRes, profsRes, psRes] = await Promise.all([
        pb.collection('services').getFullList<Service>({
          filter: `organization_id = "${orgId}"`,
          sort: 'name',
        }),
        pb.collection('professionals').getFullList<Professional>({
          filter: `organization_id = "${orgId}"`,
          sort: 'name',
        }),
        pb.collection('professional_services').getFullList<ProfessionalService>({
          filter: `organization_id = "${orgId}"`,
        }),
      ])
      setServices(servsRes)
      setProfessionals(profsRes)
      setProfServices(psRes)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [orgId])

  const openCreateModal = () => {
    setIsEditing(false)
    setEditId(null)
    setName('')
    setDescription('')
    setDuration(45)
    setPrice(150)
    setColor(SERVICE_COLORS[Math.floor(Math.random() * SERVICE_COLORS.length)])
    setCategory('Geral')
    setActive(true)
    setModalOpen(true)
  }

  const openEditModal = (serv: Service) => {
    setIsEditing(true)
    setEditId(serv.id)
    setName(serv.name)
    setDescription(serv.description || '')
    setDuration(serv.duration)
    setPrice(serv.price)
    setColor(serv.color || '#10b981')
    setCategory(serv.category || 'Geral')
    setActive(serv.active !== false)
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !name.trim()) {
      toast.error('Informe o nome do serviço.')
      return
    }

    setSaving(true)
    try {
      const data = {
        organization_id: orgId,
        name: name.trim(),
        description: description.trim(),
        duration: duration,
        price: price,
        color: color,
        category: category.trim() || 'Geral',
        active: active,
      }

      if (isEditing && editId) {
        await pb.collection('services').update(editId, data)
        toast.success('Serviço atualizado com sucesso!')
      } else {
        await pb.collection('services').create(data)
        toast.success('Serviço cadastrado com sucesso!')
      }

      setModalOpen(false)
      await loadData()
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao salvar serviço.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este serviço do catálogo?')) return
    try {
      await pb.collection('services').delete(id)
      toast.success('Serviço excluído.')
      await loadData()
    } catch (err) {
      toast.error('Erro ao excluir serviço.')
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-emerald-600" />
            Serviços
          </h1>
          <p className="text-xs text-slate-500">
            Catálogo de procedimentos, durações e preços para agendamento interno e online.
          </p>
        </div>

        <Button
          size="sm"
          onClick={openCreateModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Novo Serviço
        </Button>
      </div>

      {/* SERVICES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200 p-8">
            <CalendarDays className="w-12 h-12 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Nenhum serviço cadastrado</p>
            <p className="text-xs text-slate-400 mt-1">
              Crie seus serviços com durações e valores para agilizar o atendimento.
            </p>
            <Button
              size="sm"
              onClick={openCreateModal}
              className="mt-4 bg-emerald-600 text-white text-xs"
            >
              Cadastrar Primeiro Serviço
            </Button>
          </div>
        ) : (
          services.map((serv) => {
            const linkedProfs = profServices
              .filter((ps) => ps.service_id === serv.id)
              .map((ps) => professionals.find((p) => p.id === ps.professional_id))
              .filter(Boolean) as Professional[]

            return (
              <Card
                key={serv.id}
                className="border-slate-200 bg-white shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: serv.color || '#10b981' }}
                      />
                      <CardTitle className="text-base text-slate-900 leading-snug">
                        {serv.name}
                      </CardTitle>
                    </div>
                    <Badge
                      variant={serv.active ? 'default' : 'secondary'}
                      className={
                        serv.active
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]'
                          : 'bg-slate-100 text-slate-500 text-[10px]'
                      }
                    >
                      {serv.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  {serv.description && (
                    <CardDescription className="text-xs text-slate-500 line-clamp-2 pt-1">
                      {serv.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="p-4 pt-2 space-y-3 text-xs flex-1">
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-800">{serv.duration} minutos</span>
                    </div>

                    <div className="font-bold text-sm text-emerald-700 font-mono">
                      {formatCurrency(serv.price)}
                    </div>
                  </div>

                  {/* Linked Professionals */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                      Profissionais que realizam ({linkedProfs.length}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {linkedProfs.length === 0 ? (
                        <span className="text-slate-400 text-[10px]">
                          Disponível para todos / nenhum vinculado
                        </span>
                      ) : (
                        linkedProfs.map((p) => (
                          <span
                            key={p.id}
                            className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium"
                          >
                            {p.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>

                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditModal(serv)}
                    className="text-xs h-7 px-2 text-slate-700 hover:bg-slate-200"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(serv.id)}
                    className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {isEditing ? 'Editar Serviço' : 'Novo Serviço'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Configure os parâmetros de duração, preço e cor visual deste serviço.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Nome do Serviço *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Limpeza de Pele, Massagem, Consulta..."
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes sobre o procedimento..."
                  className="text-xs h-16 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Duração (minutos) *
                  </Label>
                  <Input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Preço (R$) *</Label>
                  <Input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    required
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Facial, Corporal, Geral..."
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Cor na Agenda</Label>
                  <div className="flex items-center gap-1.5 pt-1">
                    {SERVICE_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          color === c
                            ? 'scale-110 border-slate-900 shadow-sm'
                            : 'border-transparent'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 block">
                    Serviço Ativo
                  </Label>
                  <span className="text-[11px] text-slate-400">Exibir na lista de agendamento</span>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
              >
                {saving ? 'Salvando...' : isEditing ? 'Atualizar Serviço' : 'Cadastrar Serviço'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default Servicos
