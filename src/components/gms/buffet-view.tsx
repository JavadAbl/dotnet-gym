"use client";

import * as React from "react";
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CupSoda,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingBasket,
  Wallet as WalletIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createBuffetOrder,
  getBuffetSummary,
  getWalletSnapshot,
  listProducts,
  searchBuffetOrders,
  searchMembers,
} from "@/lib/gms/api";
import type {
  Branch,
  BuffetOrder,
  BuffetProduct,
  BuffetSummary,
  Member,
  PaymentMethod,
  WalletSnapshot,
} from "@/lib/gms/types";
import { formatDateTime, formatNumber, formatToman } from "@/lib/gms/jalali";
import { StatusBadge } from "./status-badge";
import { describeError } from "./sell-package-dialog";
import { ProductDialog } from "./product-dialog";
import { useAuth, useI18n } from "./providers";

interface BuffetViewProps {
  branches: Branch[];
  refreshSignal: number;
}

const PAGE_SIZE = 10;
const MAX_QUANTITY = 99;

export function BuffetView({ branches, refreshSignal }: BuffetViewProps) {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const user = session!.user;
  const isAdmin = user.role === "admin";
  const pinnedBranchId = user.branchId ?? null;

  const [tab, setTab] = React.useState<"pos" | "orders" | "products">("pos");
  const [refreshBump, setRefreshBump] = React.useState(0);

  // branch: reception/buffet pinned to their claim, admin picks (check-in pattern)
  const [branchId, setBranchId] = React.useState(pinnedBranchId ?? "");
  const effectiveBranchId = pinnedBranchId ?? branchId;

  // ---------------------------------------------------------------- KPI summary + catalog
  const [summary, setSummary] = React.useState<BuffetSummary | null>(null);
  const [summaryError, setSummaryError] = React.useState(false);
  const [products, setProducts] = React.useState<BuffetProduct[] | null>(null);
  const [productsError, setProductsError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getBuffetSummary(effectiveBranchId || undefined)
      .then((result) => {
        if (!cancelled) {
          setSummary(result);
          setSummaryError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(null);
          setSummaryError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveBranchId, refreshBump, refreshSignal]);

  React.useEffect(() => {
    let cancelled = false;
    listProducts()
      .then((items) => {
        if (!cancelled) {
          setProducts(items);
          setProductsError(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProducts(null);
          setProductsError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshBump, refreshSignal]);

  const localizedProductName = React.useCallback(
    (product: { nameEn: string; nameFa: string }) => (locale === "fa" ? product.nameFa : product.nameEn),
    [locale],
  );

  const priceInBranch = React.useCallback(
    (product: BuffetProduct, branch: string | null | undefined) =>
      branch ? product.prices.find((p) => p.branchId === branch) ?? null : null,
    [],
  );

  // ---------------------------------------------------------------- POS tab
  const [memberQuery, setMemberQuery] = React.useState("");
  const [memberResults, setMemberResults] = React.useState<Member[]>([]);
  const [memberSearchOpen, setMemberSearchOpen] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<Member | null>(null);
  const [quantities, setQuantities] = React.useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("Cash");
  const [wallet, setWallet] = React.useState<WalletSnapshot | null>(null);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [orderError, setOrderError] = React.useState<string | null>(null);
  const [lastOrder, setLastOrder] = React.useState<BuffetOrder | null>(null);

  React.useEffect(() => {
    // switching the branch changes prices — reset the cart
    setQuantities({});
    setLastOrder(null);
    setOrderError(null);
  }, [effectiveBranchId]);

  React.useEffect(() => {
    if (!selectedMember || paymentMethod !== "Wallet") {
      setWallet(null);
      return;
    }
    let cancelled = false;
    getWalletSnapshot(selectedMember.id)
      .then((snapshot) => {
        if (!cancelled) setWallet(snapshot);
      })
      .catch(() => {
        if (!cancelled) setWallet(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMember, paymentMethod, refreshBump]);

  // debounced member search
  React.useEffect(() => {
    const handle = setTimeout(() => {
      const term = memberQuery.trim();
      if (term.length === 0) {
        setMemberResults([]);
        setMemberSearchOpen(false);
        return;
      }
      searchMembers({ search: term, page: 1, pageSize: 6 })
        .then((res) => {
          setMemberResults(res.items);
          setMemberSearchOpen(true);
        })
        .catch(() => setMemberResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [memberQuery]);

  const cartLines = React.useMemo(() => {
    if (!products) return [];
    return Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => {
        const product = products.find((p) => p.id === productId)!;
        const price = priceInBranch(product, effectiveBranchId);
        const unitPriceToman = price?.priceToman ?? 0;
        return { product, quantity, unitPriceToman, lineTotalToman: unitPriceToman * quantity };
      });
  }, [quantities, products, effectiveBranchId, priceInBranch]);

  const totalToman = cartLines.reduce((sum, line) => sum + line.lineTotalToman, 0);
  const walletBalance = wallet?.balanceToman ?? 0;
  const walletInsufficient = paymentMethod === "Wallet" && selectedMember !== null && wallet !== null && walletBalance < totalToman;
  const memberInactive = selectedMember !== null && selectedMember.status !== "Active";
  const canSubmit =
    selectedMember !== null &&
    Boolean(effectiveBranchId) &&
    cartLines.length > 0 &&
    totalToman > 0 &&
    !memberInactive &&
    !walletInsufficient &&
    !submitting;

  function setQuantity(productId: string, quantity: number) {
    setQuantities((prev) => {
      const next = { ...prev };
      if (quantity <= 0) {
        delete next[productId];
      } else {
        next[productId] = Math.min(quantity, MAX_QUANTITY);
      }
      return next;
    });
    setLastOrder(null);
    setOrderError(null);
  }

  function pickMember(member: Member) {
    setSelectedMember(member);
    setMemberSearchOpen(false);
    setMemberQuery("");
  }

  async function handleSubmitOrder(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedMember || !effectiveBranchId || cartLines.length === 0) return;

    setSubmitting(true);
    setOrderError(null);
    try {
      const order = await createBuffetOrder({
        memberId: selectedMember.id,
        branchId: effectiveBranchId,
        paymentMethod,
        items: cartLines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
        note: note.trim() || undefined,
      });
      setLastOrder(order);
      toast.success(t("buffet.pos.success.toast", { amount: formatToman(order.totalToman, locale) }));
      setQuantities({});
      setNote("");
      setRefreshBump((n) => n + 1);
    } catch (err) {
      setOrderError(describeError(t, err));
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------- orders tab
  const [orderSearchInput, setOrderSearchInput] = React.useState("");
  const [orderSearch, setOrderSearch] = React.useState("");
  const [orderBranchFilter, setOrderBranchFilter] = React.useState<string>("all");
  const [orderMethodFilter, setOrderMethodFilter] = React.useState<string>("all");
  const [orderPage, setOrderPage] = React.useState(1);
  const [orders, setOrders] = React.useState<BuffetOrder[] | null>(null);
  const [orderCount, setOrderCount] = React.useState(0);
  const [ordersLoading, setOrdersLoading] = React.useState(false);
  const [ordersError, setOrdersError] = React.useState(false);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setOrderSearch(orderSearchInput.trim());
      setOrderPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [orderSearchInput]);

  React.useEffect(() => {
    if (tab !== "orders") return;
    let cancelled = false;
    setOrdersLoading(true);
    searchBuffetOrders({
      search: orderSearch || undefined,
      branchId: (isAdmin ? (orderBranchFilter !== "all" ? orderBranchFilter : undefined) : effectiveBranchId || undefined),
      paymentMethod: orderMethodFilter !== "all" ? (orderMethodFilter as PaymentMethod) : undefined,
      page: orderPage,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setOrders(result.items);
        setOrderCount(result.totalCount);
        setOrdersError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setOrders([]);
          setOrderCount(0);
          setOrdersError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, orderSearch, orderBranchFilter, orderMethodFilter, orderPage, refreshBump, refreshSignal, isAdmin, effectiveBranchId]);

  const orderTotalPages = Math.max(1, Math.ceil(orderCount / PAGE_SIZE));

  // ---------------------------------------------------------------- products tab (admin)
  const [productDialogOpen, setProductDialogOpen] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<BuffetProduct | null>(null);

  const activeBranches = branches.filter((b) => b.isActive);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("buffet.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("buffet.subtitle")}</p>
      </div>

      {/* KPI chips */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            key: "buffet.kpi.ordersToday",
            icon: ShoppingBasket,
            value: summary ? formatNumber(summary.ordersToday, locale) : null,
            tone: "bg-emerald-600",
          },
          {
            key: "buffet.kpi.revenueToday",
            icon: ReceiptText,
            value: summary ? formatToman(summary.revenueTodayToman, locale) : null,
            tone: "bg-teal-600",
          },
          {
            key: "buffet.kpi.cashToday",
            icon: Banknote,
            value: summary ? formatToman(summary.cashRevenueTodayToman, locale) : null,
            tone: "bg-amber-600",
          },
          {
            key: "buffet.kpi.walletToday",
            icon: WalletIcon,
            value: summary ? formatToman(summary.walletRevenueTodayToman, locale) : null,
            tone: "bg-violet-600",
          },
        ].map((chip) => {
          const Icon = chip.icon;
          return (
            <Card key={chip.key} className="py-0">
              <CardContent className="flex items-center gap-3 p-4">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${chip.tone} text-white`}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  {chip.value === null && !summaryError ? (
                    <Skeleton className="mb-1 h-6 w-20" />
                  ) : (
                    <p className="truncate text-lg font-bold tabular-nums">{chip.value ?? "—"}</p>
                  )}
                  <p className="truncate text-xs text-muted-foreground">{t(chip.key)}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="pos" className="gap-1.5">
            <CupSoda className="h-4 w-4" />
            {t("buffet.tab.pos")}
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5">
            <ReceiptText className="h-4 w-4" />
            {t("buffet.tab.orders")}
          </TabsTrigger>
          {isAdmin ? (
            <TabsTrigger value="products" className="gap-1.5">
              <ShoppingBasket className="h-4 w-4" />
              {t("buffet.tab.products")}
            </TabsTrigger>
          ) : null}
        </TabsList>
      </Tabs>

      {/* ---------------------------------------------------------------- POS tab */}
      {tab === "pos" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* member + products */}
          <div className="space-y-4 lg:col-span-3">
            <div className="space-y-1.5">
              <Label>{t("buffet.pos.member")}</Label>
              {selectedMember ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                      {selectedMember.fullName.slice(0, 1)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{selectedMember.fullName}</p>
                      <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                        {selectedMember.code}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedMember.status} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
                      ×
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3" />
                  <Input
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder={t("buffet.pos.member.placeholder")}
                    className="ps-9"
                  />
                  {memberSearchOpen ? (
                    <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md">
                      {memberResults.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-muted-foreground">{t("buffet.pos.member.none")}</p>
                      ) : (
                        memberResults.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => pickMember(member)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start hover:bg-accent"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{member.fullName}</span>
                              <span className="block font-mono text-xs text-muted-foreground" dir="ltr">
                                {member.code}
                              </span>
                            </span>
                            <StatusBadge status={member.status} />
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              )}
              {memberInactive ? (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <CircleAlert className="h-3.5 w-3.5" />
                  {t("buffet.pos.activeMemberOnly")}
                </p>
              ) : null}
            </div>

            {/* branch: pinned for reception/buffet, admin picks (affects per-branch prices) */}
            <div className="space-y-1.5">
              <Label>{t("buffet.pos.branch")}</Label>
              {pinnedBranchId ? (
                <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                  {(() => {
                    const branch = branches.find((b) => b.id === pinnedBranchId);
                    return branch ? (locale === "fa" ? branch.nameFa : branch.nameEn) : t("checkin.branch.pinned");
                  })()}
                </div>
              ) : (
                <Select
                  value={branchId || undefined}
                  onValueChange={(value) => {
                    setBranchId(value);
                  }}
                >
                  <SelectTrigger className="sm:w-60">
                    <SelectValue placeholder={t("buffet.pos.branch.placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {locale === "fa" ? branch.nameFa : branch.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* product grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {products === null && !productsError
                ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)
                : null}
              {productsError ? (
                <p className="text-sm text-destructive sm:col-span-2">{t("common.error.load")}</p>
              ) : null}
              {products
                ?.filter((product) => product.isActive)
                .map((product) => {
                  const price = priceInBranch(product, effectiveBranchId);
                  const quantity = quantities[product.id] ?? 0;
                  return (
                    <Card key={product.id} className={`py-0 ${price ? "" : "opacity-60"}`}>
                      <CardContent className="flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{localizedProductName(product)}</p>
                          <p className="mt-0.5 text-sm font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                            {price ? formatToman(price.priceToman, locale) : t("buffet.pos.notPriced")}
                          </p>
                        </div>
                        {price ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={t("buffet.pos.decrease")}
                              disabled={quantity === 0}
                              onClick={() => setQuantity(product.id, quantity - 1)}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-8 text-center text-sm font-bold tabular-nums" dir="ltr">
                              {formatNumber(quantity, locale)}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={t("buffet.pos.increase")}
                              disabled={!effectiveBranchId || quantity >= MAX_QUANTITY}
                              onClick={() => setQuantity(product.id, quantity + 1)}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>

          {/* order summary */}
          <form onSubmit={handleSubmitOrder} className="lg:col-span-2">
            <Card className="py-0 lg:sticky lg:top-20">
              <CardContent className="space-y-4 p-4">
                <p className="text-sm font-semibold">{t("buffet.pos.summary")}</p>

                {cartLines.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    {t("buffet.pos.emptyCart")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {cartLines.map((line) => (
                      <li key={line.product.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">
                          {formatNumber(line.quantity, locale)}× {localizedProductName(line.product)}
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground" dir="ltr">
                          {line.lineTotalToman.toLocaleString("en-US")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-semibold">{t("buffet.pos.total")}</span>
                  <span className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatToman(totalToman, locale)}
                  </span>
                </div>

                {/* payment method: cash XOR wallet (locked decision #5) */}
                <div className="space-y-1.5">
                  <Label>{t("buffet.pos.payment")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Cash", "Wallet"] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          paymentMethod === method
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {method === "Cash" ? <Banknote className="h-4 w-4" /> : <WalletIcon className="h-4 w-4" />}
                        {t(`buffet.pos.payment.${method.toLowerCase()}`)}
                      </button>
                    ))}
                  </div>
                  {paymentMethod === "Wallet" ? (
                    selectedMember === null ? (
                      <p className="text-xs text-muted-foreground">{t("buffet.pos.wallet.pickMember")}</p>
                    ) : wallet === null ? (
                      <Skeleton className="h-4 w-28" />
                    ) : (
                      <p
                        className={`text-xs tabular-nums ${walletInsufficient ? "font-medium text-destructive" : "text-muted-foreground"}`}
                      >
                        {t("buffet.pos.wallet.balance", { amount: formatToman(walletBalance, locale) })}
                        {walletInsufficient ? ` · ${t("buffet.pos.wallet.insufficient")}` : ""}
                      </p>
                    )
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="buffet-note">{t("buffet.pos.note")}</Label>
                  <Input
                    id="buffet-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("buffet.pos.note.placeholder")}
                    maxLength={200}
                  />
                </div>

                {lastOrder ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950">
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                      <CircleCheck className="h-4 w-4" />
                      {t("buffet.pos.success.title")}
                    </p>
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                      {t("buffet.pos.success.total", { amount: formatToman(lastOrder.totalToman, locale) })}
                    </p>
                  </div>
                ) : null}

                {orderError ? (
                  <p className="flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    {orderError}
                  </p>
                ) : null}

                <Button type="submit" disabled={!canSubmit} className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <ShoppingBasket className="h-4 w-4" />
                  {submitting ? t("buffet.pos.submitting") : t("buffet.pos.submit")}
                </Button>
              </CardContent>
            </Card>
          </form>
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- orders tab */}
      {tab === "orders" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground start-3" />
              <Input
                value={orderSearchInput}
                onChange={(e) => setOrderSearchInput(e.target.value)}
                placeholder={t("buffet.orders.search")}
                className="ps-9"
              />
            </div>
            {isAdmin ? (
              <Select
                value={orderBranchFilter}
                onValueChange={(value) => {
                  setOrderBranchFilter(value);
                  setOrderPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("buffet.orders.branch.all")}</SelectItem>
                  {activeBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {locale === "fa" ? branch.nameFa : branch.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select
              value={orderMethodFilter}
              onValueChange={(value) => {
                setOrderMethodFilter(value);
                setOrderPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("buffet.orders.method.all")}</SelectItem>
                <SelectItem value="Cash">{t("buffet.pos.payment.cash")}</SelectItem>
                <SelectItem value="Wallet">{t("buffet.pos.payment.wallet")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("buffet.column.member")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("buffet.column.items")}</TableHead>
                  <TableHead>{t("buffet.column.total")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("buffet.column.payment")}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t("buffet.column.branch")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("buffet.column.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersLoading ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ) : ordersError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-destructive">
                      {t("common.error.load")}
                    </TableCell>
                  </TableRow>
                ) : orders && orders.length > 0 ? (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <p className="truncate text-sm font-medium">{order.memberFullName}</p>
                        <p className="font-mono text-xs text-muted-foreground" dir="ltr">
                          {order.memberCode}
                        </p>
                      </TableCell>
                      <TableCell className="hidden max-w-64 md:table-cell">
                        <p className="truncate text-sm text-muted-foreground">
                          {order.items
                            .map((item) => `${formatNumber(item.quantity, locale)}× ${localizedProductName(item)}`)
                            .join("، ")}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm font-semibold tabular-nums">
                        {formatToman(order.totalToman, locale)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge
                          variant="secondary"
                          className={
                            order.paymentMethod === "Wallet"
                              ? "bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-300"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300"
                          }
                        >
                          {t(`buffet.pos.payment.${order.paymentMethod.toLowerCase()}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                        {locale === "fa" ? order.branchNameFa : order.branchNameEn}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {formatDateTime(order.createdAtUtc, locale)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      <p className="text-sm font-medium">{t("buffet.orders.empty.title")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t("buffet.orders.empty.description")}</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{t("buffet.orders.count", { count: formatNumber(orderCount, locale) })}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={orderPage <= 1 || ordersLoading}
                onClick={() => setOrderPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                {t("common.prev")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("common.page", { page: orderPage, total: orderTotalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={orderPage >= orderTotalPages || ordersLoading}
                onClick={() => setOrderPage((p) => p + 1)}
              >
                {t("common.next")}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- products tab (admin only) */}
      {tab === "products" && isAdmin ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t("buffet.products.subtitle")}</p>
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setEditingProduct(null);
                setProductDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("buffet.products.new")}
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("buffet.column.product")}</TableHead>
                  {activeBranches.map((branch) => (
                    <TableHead key={branch.id}>{locale === "fa" ? branch.nameFa : branch.nameEn}</TableHead>
                  ))}
                  <TableHead>{t("buffet.column.status")}</TableHead>
                  <TableHead className="text-end">{t("buffet.column.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products === null && !productsError
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell colSpan={2 + activeBranches.length}>
                          <Skeleton className="h-7 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
                {productsError ? (
                  <TableRow>
                    <TableCell colSpan={2 + activeBranches.length} className="text-sm text-destructive">
                      {t("common.error.load")}
                    </TableCell>
                  </TableRow>
                ) : null}
                {products?.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <p className="text-sm font-medium">{localizedProductName(product)}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">
                        {locale === "fa" ? product.nameEn : product.nameFa}
                      </p>
                    </TableCell>
                    {activeBranches.map((branch) => {
                      const price = product.prices.find((p) => p.branchId === branch.id);
                      return (
                        <TableCell key={branch.id} className="text-sm tabular-nums">
                          {price ? formatToman(price.priceToman, locale) : "—"}
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          product.isActive
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300"
                        }
                      >
                        {product.isActive ? t("buffet.status.active") : t("buffet.status.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingProduct(product);
                          setProductDialogOpen(true);
                        }}
                      >
                        {t("buffet.products.edit")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        branches={branches}
        product={editingProduct}
        onSaved={(saved, mode) => {
          toast.success(mode === "create" ? t("buffet.product.created") : t("buffet.product.updated"));
          setRefreshBump((n) => n + 1);
          void saved;
        }}
      />
    </div>
  );
}
