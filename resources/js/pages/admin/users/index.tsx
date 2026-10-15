import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    Anchor,
    Check,
    CheckCircle2,
    Edit2,
    KeyRound,
    Layers,
    Plus,
    RotateCcw,
    Search,
    Shield,
    Ship,
    Trash2,
    UserCheck,
    Users,
    X,
} from 'lucide-react';
import React, { useState } from 'react';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface UserItem {
    id: number;
    name: string;
    email: string;
    role: 'superadmin' | 'corporate' | 'vessel';
    vessel_name: string | null;
    is_active: boolean;
    created_at: string | null;
    email_verified_at: string | null;
}

export interface VesselTypeItem {
    id: number;
    name: string;
    is_active: boolean;
    reports_count: number;
    form_applicabilities_count: number;
    created_at: string | null;
}

export interface VesselTypeStats {
    total: number;
    active: number;
    inactive: number;
    in_use: number;
}

export interface PaginationLinks {
    url: string | null;
    label: string;
    active: boolean;
}

export interface PaginatedUsers {
    data: UserItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
    links: PaginationLinks[];
}

export interface Stats {
    total: number;
    active: number;
    inactive: number;
    superadmin: number;
    corporate: number;
    vessel: number;
}

interface Props {
    users: PaginatedUsers;
    filters: {
        search: string;
        role: string;
        status: string;
    };
    stats: Stats;
    known_vessels: string[];
    vessel_types?: VesselTypeItem[];
    vessel_type_stats?: VesselTypeStats;
    active_tab?: 'users' | 'vessel-types';
}

export default function UsersIndex({
    users,
    filters,
    stats,
    known_vessels,
    vessel_types = [],
    vessel_type_stats,
    active_tab = 'users',
}: Props) {
    const page = usePage();
    const currentUserId = (page.props as any).auth?.user?.id;

    // Filter local state
    const [search, setSearch] = useState(filters.search || '');
    const [role, setRole] = useState(filters.role || 'all');
    const [status, setStatus] = useState(filters.status || 'all');

    // Tab state
    const [currentTab, setCurrentTab] = useState<'users' | 'vessel-types'>(
        active_tab === 'vessel-types' ? 'vessel-types' : 'users'
    );

    // Vessel Types Filter state
    const [vtSearch, setVtSearch] = useState('');
    const [vtStatus, setVtStatus] = useState('all');

    // Vessel Types Dialogs state
    const [createVtModalOpen, setCreateVtModalOpen] = useState(false);
    const [editingVt, setEditingVt] = useState<VesselTypeItem | null>(null);
    const [deletingVt, setDeletingVt] = useState<VesselTypeItem | null>(null);

    // Vessel Types Form state
    const vtCreateForm = useForm({
        name: '',
        is_active: true,
    });

    const vtEditForm = useForm({
        name: '',
        is_active: true,
    });

    // Dialogs state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserItem | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);

    // Form state
    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        name: '',
        email: '',
        password: '',
        role: 'vessel' as 'superadmin' | 'corporate' | 'vessel',
        vessel_name: '',
        is_active: true,
    });

    const handleTabChange = (tab: 'users' | 'vessel-types') => {
        setCurrentTab(tab);
        const url = new URL(window.location.href);
        if (tab === 'vessel-types') {
            url.searchParams.set('tab', 'vessel-types');
        } else {
            url.searchParams.delete('tab');
        }
        window.history.replaceState({}, '', url.toString());
    };

    const handleOpenCreateVt = () => {
        vtCreateForm.reset();
        vtCreateForm.clearErrors();
        setCreateVtModalOpen(true);
    };

    const handleCreateVtSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        vtCreateForm.post('/admin/vessel-types', {
            preserveScroll: true,
            onSuccess: () => {
                setCreateVtModalOpen(false);
                vtCreateForm.reset();
            },
        });
    };

    const handleOpenEditVt = (vt: VesselTypeItem) => {
        setEditingVt(vt);
        vtEditForm.setData({
            name: vt.name,
            is_active: vt.is_active,
        });
        vtEditForm.clearErrors();
    };

    const handleEditVtSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingVt) return;
        vtEditForm.put(`/admin/vessel-types/${editingVt.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingVt(null);
                vtEditForm.reset();
            },
        });
    };

    const handleToggleActiveVt = (vt: VesselTypeItem) => {
        router.post(
            `/admin/vessel-types/${vt.id}/toggle-active`,
            {},
            { preserveScroll: true }
        );
    };

    const handleDeleteVt = () => {
        if (!deletingVt) return;
        router.delete(`/admin/vessel-types/${deletingVt.id}`, {
            preserveScroll: true,
            onSuccess: () => setDeletingVt(null),
        });
    };

    const filteredVesselTypes = vessel_types.filter((vt) => {
        const matchesSearch = vtSearch === '' || vt.name.toLowerCase().includes(vtSearch.toLowerCase());
        const matchesStatus = vtStatus === 'all' || (vtStatus === 'active' ? vt.is_active : !vt.is_active);
        return matchesSearch && matchesStatus;
    });

    const handleFilterChange = (newFilters: { search?: string; role?: string; status?: string }) => {
        router.get(
            '/admin/users',
            {
                search: newFilters.search !== undefined ? newFilters.search : search,
                role: newFilters.role !== undefined ? newFilters.role : role,
                status: newFilters.status !== undefined ? newFilters.status : status,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        );
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleFilterChange({ search });
    };

    const handleResetFilters = () => {
        setSearch('');
        setRole('all');
        setStatus('all');
        router.get('/admin/users', {}, { preserveState: false, preserveScroll: true, replace: true });
    };

    const handleOpenCreate = () => {
        setEditingUser(null);
        reset();
        clearErrors();
        setData({
            name: '',
            email: '',
            password: '',
            role: 'vessel',
            vessel_name: '',
            is_active: true,
        });
        setModalOpen(true);
    };

    const handleOpenEdit = (user: UserItem) => {
        setEditingUser(user);
        clearErrors();
        setData({
            name: user.name,
            email: user.email,
            password: '', // leave blank to keep unchanged
            role: user.role,
            vessel_name: user.role === 'vessel' ? (user.vessel_name || user.name) : '',
            is_active: user.is_active,
        });
        setModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingUser) {
            put(`/admin/users/${editingUser.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    setModalOpen(false);
                    reset();
                },
            });
        } else {
            post('/admin/users', {
                preserveScroll: true,
                onSuccess: () => {
                    setModalOpen(false);
                    reset();
                },
            });
        }
    };

    const handleToggleActive = (user: UserItem) => {
        router.post(
            `/admin/users/${user.id}/toggle-active`,
            {},
            {
                preserveScroll: true,
            }
        );
    };

    const handleOpenDelete = (user: UserItem) => {
        setUserToDelete(user);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!userToDelete) return;

        router.delete(`/admin/users/${userToDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setDeleteModalOpen(false);
                setUserToDelete(null);
            },
        });
    };

    const isFiltered = filters.search !== '' || filters.role !== 'all' || filters.status !== 'all';

    return (
        <>
            <Head title={currentTab === 'vessel-types' ? 'Vessel Types - Administration' : 'User Accounts - Administration'} />

            <div className="flex h-full flex-1 flex-col gap-5 p-6 max-w-7xl mx-auto w-full">
                {/* Header Section */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs font-semibold gap-1">
                                <Shield className="size-3" /> System Administration
                            </Badge>
                        </div>
                        <Heading
                            title="Accounts & Vessel Types"
                            description="Manage corporate, vessel, and admin accounts, plus vessel type classifications."
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        {currentTab === 'users' ? (
                            <Button onClick={handleOpenCreate} className="flex items-center gap-1.5 self-start shadow-xs">
                                <Plus className="size-4" />
                                <span>Add User</span>
                            </Button>
                        ) : (
                            <Button onClick={handleOpenCreateVt} className="flex items-center gap-1.5 self-start shadow-xs">
                                <Plus className="size-4" />
                                <span>Add Vessel Type</span>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
                    <button
                        type="button"
                        onClick={() => handleTabChange('users')}
                        className={cn(
                            'flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors',
                            currentTab === 'users'
                                ? 'bg-background text-foreground shadow-xs font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Users className="size-3.5" />
                        <span>User Accounts</span>
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                            {stats.total}
                        </Badge>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange('vessel-types')}
                        className={cn(
                            'flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors',
                            currentTab === 'vessel-types'
                                ? 'bg-background text-foreground shadow-xs font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        <Ship className="size-3.5" />
                        <span>Vessel Types</span>
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                            {vessel_type_stats?.total ?? vessel_types.length}
                        </Badge>
                    </button>
                </div>

                {currentTab === 'users' && (
                    <div className="flex flex-col gap-5">
                        {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="shadow-xs">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Total Accounts
                            </CardTitle>
                            <Users className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {stats.active} active ({stats.inactive} inactive)
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-xs">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Vessel
                            </CardTitle>
                            <Anchor className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.vessel}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Ship accounts
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-xs">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Corporate
                            </CardTitle>
                            <UserCheck className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.corporate}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Office accounts
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="shadow-xs">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Admin
                            </CardTitle>
                            <Shield className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.superadmin}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                System administrators
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filter / Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <form onSubmit={handleSearchSubmit} className="flex flex-1 flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[220px] max-w-sm">
                            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, email, or vessel..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8 text-xs h-9 bg-card"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch('');
                                        handleFilterChange({ search: '' });
                                    }}
                                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Role Filter */}
                        <Select
                            value={role}
                            onValueChange={(val) => {
                                setRole(val);
                                handleFilterChange({ role: val });
                            }}
                        >
                            <SelectTrigger className="w-[140px] h-9 text-xs bg-card">
                                <SelectValue placeholder="All Roles" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                <SelectItem value="corporate">Corporate</SelectItem>
                                <SelectItem value="vessel">Vessel</SelectItem>
                                <SelectItem value="superadmin">Admin</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Status Filter */}
                        <Select
                            value={status}
                            onValueChange={(val) => {
                                setStatus(val);
                                handleFilterChange({ status: val });
                            }}
                        >
                            <SelectTrigger className="w-[130px] h-9 text-xs bg-card">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="active">Active only</SelectItem>
                                <SelectItem value="inactive">Inactive only</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button type="submit" size="sm" variant="secondary" className="h-9 px-3 text-xs">
                            Search
                        </Button>

                        {isFiltered && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleResetFilters}
                                className="h-9 px-2.5 text-xs gap-1"
                                title="Reset filters"
                            >
                                <RotateCcw className="size-3" />
                                Reset
                            </Button>
                        )}
                    </form>
                </div>

                {/* Users Table */}
                <Card className="shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/40 border-b text-xs font-semibold uppercase text-muted-foreground">
                                <tr>
                                    <th className="px-4 py-3">User Details</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Vessel Scope</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {users.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Users className="size-8 text-muted-foreground/50" />
                                                <p className="font-medium">No user accounts found</p>
                                                <p className="text-xs">Try adjusting your search criteria or add a new account.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    users.data.map((user) => {
                                        const isSelf = user.id === currentUserId;

                                        return (
                                            <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                                                            {user.name}
                                                            {isSelf && (
                                                                <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground font-normal">
                                                                    You
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {user.email}
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3">
                                                    {user.role === 'superadmin' && (
                                                        <Badge variant="default" className="text-xs font-medium">
                                                            Admin
                                                        </Badge>
                                                    )}
                                                    {user.role === 'corporate' && (
                                                        <Badge variant="secondary" className="text-xs font-medium">
                                                            Corporate
                                                        </Badge>
                                                    )}
                                                    {user.role === 'vessel' && (
                                                        <Badge variant="outline" className="text-xs font-medium">
                                                            Vessel
                                                        </Badge>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {user.role === 'vessel' ? (
                                                        <span className="font-medium text-foreground">
                                                            {user.vessel_name || '—'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">
                                                            All Fleet
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3">
                                                    {user.is_active ? (
                                                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                                                            Active
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-muted-foreground text-xs">
                                                            Inactive
                                                        </Badge>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleToggleActive(user)}
                                                            disabled={isSelf}
                                                            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                            title={isSelf ? 'You cannot deactivate your own account' : user.is_active ? 'Deactivate user' : 'Activate user'}
                                                        >
                                                            {user.is_active ? 'Deactivate' : 'Activate'}
                                                        </Button>

                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8"
                                                            onClick={() => handleOpenEdit(user)}
                                                            title="Edit user"
                                                        >
                                                            <Edit2 className="size-3.5" />
                                                        </Button>

                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            disabled={isSelf}
                                                            onClick={() => handleOpenDelete(user)}
                                                            title={isSelf ? 'You cannot delete yourself' : 'Delete user'}
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {users.last_page > 1 && (
                        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
                            <div>
                                Showing <span className="font-medium text-foreground">{users.from}</span> to{' '}
                                <span className="font-medium text-foreground">{users.to}</span> of{' '}
                                <span className="font-medium text-foreground">{users.total}</span> accounts
                            </div>
                            <div className="flex gap-1">
                                {users.links.map((link, idx) => {
                                    if (!link.url) {
                                        return (
                                            <span
                                                key={idx}
                                                className="px-2.5 py-1 text-muted-foreground/50 rounded-md border text-xs"
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                            />
                                        );
                                    }

                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => router.get(link.url!, {}, { preserveState: true, preserveScroll: true })}
                                            className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                                                link.active
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'hover:bg-muted text-foreground'
                                            }`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </Card>
                    </div>
                )}

                {currentTab === 'vessel-types' && (
                    <div className="flex flex-col gap-5">
                        {/* Vessel Types KPI Summary */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card className="shadow-xs">
                                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Total Types
                                    </CardTitle>
                                    <Ship className="size-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{vessel_type_stats?.total ?? vessel_types.length}</div>
                                    <p className="text-xs text-muted-foreground mt-1">Configured classifications</p>
                                </CardContent>
                            </Card>

                            <Card className="shadow-xs">
                                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Active
                                    </CardTitle>
                                    <CheckCircle2 className="size-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{vessel_type_stats?.active ?? vessel_types.filter(v => v.is_active).length}</div>
                                    <p className="text-xs text-muted-foreground mt-1">Available for new forms</p>
                                </CardContent>
                            </Card>

                            <Card className="shadow-xs">
                                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Inactive
                                    </CardTitle>
                                    <X className="size-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{vessel_type_stats?.inactive ?? vessel_types.filter(v => !v.is_active).length}</div>
                                    <p className="text-xs text-muted-foreground mt-1">Deactivated</p>
                                </CardContent>
                            </Card>

                            <Card className="shadow-xs">
                                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        In Use
                                    </CardTitle>
                                    <Layers className="size-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{vessel_type_stats?.in_use ?? vessel_types.filter(v => v.reports_count > 0 || v.form_applicabilities_count > 0).length}</div>
                                    <p className="text-xs text-muted-foreground mt-1">Linked to reports or rules</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Vessel Types Filter / Search */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                            <div className="flex flex-1 flex-wrap items-center gap-2">
                                <div className="relative flex-1 min-w-[220px] max-w-sm">
                                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Search vessel type..."
                                        value={vtSearch}
                                        onChange={(e) => setVtSearch(e.target.value)}
                                        className="pl-8 text-xs h-9 bg-card"
                                    />
                                    {vtSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setVtSearch('')}
                                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    )}
                                </div>

                                <Select value={vtStatus} onValueChange={setVtStatus}>
                                    <SelectTrigger className="w-[130px] h-9 text-xs bg-card">
                                        <SelectValue placeholder="All Statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Statuses</SelectItem>
                                        <SelectItem value="active">Active only</SelectItem>
                                        <SelectItem value="inactive">Inactive only</SelectItem>
                                    </SelectContent>
                                </Select>

                                {(vtSearch !== '' || vtStatus !== 'all') && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setVtSearch('');
                                            setVtStatus('all');
                                        }}
                                        className="h-9 px-2.5 text-xs gap-1"
                                    >
                                        <RotateCcw className="size-3" />
                                        Reset
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Vessel Types Table */}
                        <Card className="shadow-xs overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-muted/40 border-b text-xs font-semibold uppercase text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3">Vessel Type</th>
                                            <th className="px-4 py-3">Linked Reports</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {filteredVesselTypes.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                                                    <div className="flex flex-col items-center justify-center gap-2">
                                                        <Ship className="size-8 text-muted-foreground/50" />
                                                        <p className="font-medium">No vessel types found</p>
                                                        <p className="text-xs">Try adjusting your search criteria or add a new vessel type.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredVesselTypes.map((type) => {
                                                const isInUse = type.reports_count > 0 || type.form_applicabilities_count > 0;

                                                return (
                                                    <tr key={type.id} className="hover:bg-muted/30 transition-colors">
                                                        <td className="px-4 py-3 font-semibold text-foreground">
                                                            <div className="flex items-center gap-2">
                                                                <Ship className="size-4 text-muted-foreground shrink-0" />
                                                                <span>{type.name}</span>
                                                            </div>
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            {type.reports_count > 0 ? (
                                                                <Badge variant="secondary" className="text-xs font-normal">
                                                                    {type.reports_count} report{type.reports_count > 1 ? 's' : ''}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">—</span>
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            {type.is_active ? (
                                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs">
                                                                    Active
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-muted-foreground text-xs">
                                                                    Inactive
                                                                </Badge>
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleToggleActiveVt(type)}
                                                                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                                    title={type.is_active ? 'Deactivate' : 'Activate'}
                                                                >
                                                                    <Switch
                                                                        checked={type.is_active}
                                                                        className="pointer-events-none scale-75"
                                                                    />
                                                                </Button>

                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleOpenEditVt(type)}
                                                                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                                    title="Edit vessel type"
                                                                >
                                                                    <Edit2 className="size-3.5" />
                                                                </Button>

                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => setDeletingVt(type)}
                                                                    className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                                                                    title={isInUse ? 'Cannot delete: linked to reports or rules' : 'Delete vessel type'}
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                )}
            </div>

            {/* Create / Edit Modal Dialog */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingUser ? 'Edit User' : 'Add User'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingUser
                                ? 'Update account credentials and role.'
                                : 'Create a new corporate, vessel, or admin account.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="user-role">Role</Label>
                            <Select
                                value={data.role}
                                onValueChange={(val: 'superadmin' | 'corporate' | 'vessel') => {
                                    setData((prev) => ({
                                        ...prev,
                                        role: val,
                                        vessel_name: val === 'vessel' ? prev.name : '',
                                    }));
                                }}
                            >
                                <SelectTrigger id="user-role" className="h-9">
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="corporate">Corporate</SelectItem>
                                    <SelectItem value="vessel">Vessel</SelectItem>
                                    <SelectItem value="superadmin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.role && (
                                <p className="text-xs text-destructive">{errors.role}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="user-name">
                                {data.role === 'vessel' ? 'Vessel Name' : 'Full Name'}
                            </Label>
                            <Input
                                id="user-name"
                                value={data.name}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setData((prev) => ({
                                        ...prev,
                                        name: val,
                                        vessel_name: prev.role === 'vessel' ? val : '',
                                    }));
                                }}
                                placeholder={
                                    data.role === 'vessel'
                                        ? 'e.g. PB.ASUWA or MV Amarin Glory'
                                        : 'e.g. Capt. J. Doe'
                                }
                                list={data.role === 'vessel' ? 'vessel-options' : undefined}
                                autoFocus
                            />
                            {data.role === 'vessel' && (
                                <datalist id="vessel-options">
                                    {known_vessels.map((v) => (
                                        <option key={v} value={v} />
                                    ))}
                                </datalist>
                            )}
                            {errors.name && (
                                <p className="text-xs text-destructive">{errors.name}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="user-email">Email Address (Login Username)</Label>
                            <Input
                                id="user-email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder={data.role === 'vessel' ? 'e.g. asuwa@ptabb.com' : 'e.g. user@ptabb.com'}
                            />
                            {errors.email && (
                                <p className="text-xs text-destructive">{errors.email}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="user-password">
                                {editingUser ? 'Password (leave blank to keep unchanged)' : 'Initial Password'}
                            </Label>
                            <Input
                                id="user-password"
                                type="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder={editingUser ? '••••••••' : 'Minimum 8 characters'}
                            />
                            {errors.password && (
                                <p className="text-xs text-destructive">{errors.password}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3 shadow-2xs">
                            <div className="space-y-0.5">
                                <Label htmlFor="user-active" className="text-sm font-medium">
                                    Active Account
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Inactive accounts are prevented from logging in.
                                </p>
                            </div>
                            <Switch
                                id="user-active"
                                checked={data.is_active}
                                disabled={editingUser?.id === currentUserId}
                                onCheckedChange={(checked: boolean) => setData('is_active', checked)}
                            />
                        </div>

                        {editingUser?.id === currentUserId && (
                            <p className="text-xs text-muted-foreground italic">
                                You cannot deactivate your own logged-in account.
                            </p>
                        )}

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setModalOpen(false)}
                                disabled={processing}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Saving...' : editingUser ? 'Save Changes' : 'Create Account'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete User Account</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the account for{' '}
                            <strong>{userToDelete?.name}</strong> ({userToDelete?.email})?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2 text-sm text-muted-foreground">
                        This action will soft-delete the user account and revoke their access. Associated reports and findings will remain in the database for compliance history.
                    </div>

                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleteModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleConfirmDelete}
                        >
                            Delete User
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Vessel Type Dialog */}
            <Dialog open={createVtModalOpen} onOpenChange={setCreateVtModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Vessel Type</DialogTitle>
                        <DialogDescription>
                            Define a new vessel type classification for checklists and reports.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateVtSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="create-vt-name">Classification Name</Label>
                            <Input
                                id="create-vt-name"
                                value={vtCreateForm.data.name}
                                onChange={(e) => vtCreateForm.setData('name', e.target.value)}
                                placeholder="e.g. Chemical Tanker, Bulk Carrier"
                                autoFocus
                            />
                            {vtCreateForm.errors.name && (
                                <p className="text-xs text-destructive">{vtCreateForm.errors.name}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3 shadow-2xs">
                            <div className="space-y-0.5">
                                <Label htmlFor="create-vt-active" className="text-sm font-medium">
                                    Active Status
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Active types appear in inspection forms and applicability rules.
                                </p>
                            </div>
                            <Switch
                                id="create-vt-active"
                                checked={vtCreateForm.data.is_active}
                                onCheckedChange={(checked: boolean) => vtCreateForm.setData('is_active', checked)}
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreateVtModalOpen(false)}
                                disabled={vtCreateForm.processing}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={vtCreateForm.processing}>
                                {vtCreateForm.processing ? 'Saving...' : 'Add Type'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Vessel Type Dialog */}
            <Dialog open={Boolean(editingVt)} onOpenChange={(open) => !open && setEditingVt(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Vessel Type</DialogTitle>
                        <DialogDescription>
                            Update the vessel type classification name or active status.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleEditVtSubmit} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-vt-name">Classification Name</Label>
                            <Input
                                id="edit-vt-name"
                                value={vtEditForm.data.name}
                                onChange={(e) => vtEditForm.setData('name', e.target.value)}
                                placeholder="e.g. Chemical Tanker"
                                autoFocus
                            />
                            {vtEditForm.errors.name && (
                                <p className="text-xs text-destructive">{vtEditForm.errors.name}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between rounded-lg border p-3 shadow-2xs">
                            <div className="space-y-0.5">
                                <Label htmlFor="edit-vt-active" className="text-sm font-medium">
                                    Active Status
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Inactive types are preserved for history but hidden from new forms.
                                </p>
                            </div>
                            <Switch
                                id="edit-vt-active"
                                checked={vtEditForm.data.is_active}
                                onCheckedChange={(checked: boolean) => vtEditForm.setData('is_active', checked)}
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditingVt(null)}
                                disabled={vtEditForm.processing}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={vtEditForm.processing}>
                                {vtEditForm.processing ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Vessel Type Confirmation / In-Use Alert Dialog */}
            <Dialog open={Boolean(deletingVt)} onOpenChange={(open) => !open && setDeletingVt(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {deletingVt && (deletingVt.reports_count > 0 || deletingVt.form_applicabilities_count > 0) ? (
                                <>
                                    <AlertCircle className="size-5 text-amber-500" />
                                    <span>Cannot Delete Vessel Type</span>
                                </>
                            ) : (
                                <span>Delete Vessel Type</span>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {deletingVt && (deletingVt.reports_count > 0 || deletingVt.form_applicabilities_count > 0) ? (
                                <span>
                                    <strong>{deletingVt.name}</strong> cannot be deleted because it is currently linked to{' '}
                                    {deletingVt.reports_count > 0 && `${deletingVt.reports_count} inspection report(s)`}
                                    {deletingVt.reports_count > 0 && deletingVt.form_applicabilities_count > 0 && ' and '}
                                    {deletingVt.form_applicabilities_count > 0 && `${deletingVt.form_applicabilities_count} form applicability rule(s)`}.
                                    <span className="block mt-2 text-foreground font-medium">
                                        Deactivate this vessel type instead to prevent new selections while preserving historical data.
                                    </span>
                                </span>
                            ) : (
                                <span>
                                    Are you sure you want to delete <strong>{deletingVt?.name}</strong>? This action cannot be undone.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="pt-2">
                        {deletingVt && (deletingVt.reports_count > 0 || deletingVt.form_applicabilities_count > 0) ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDeletingVt(null)}
                            >
                                Close
                            </Button>
                        ) : (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setDeletingVt(null)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={handleDeleteVt}
                                >
                                    Delete
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

UsersIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Administration', href: '/admin/forms' },
        { title: 'User Accounts', href: '/admin/users' },
    ],
};
