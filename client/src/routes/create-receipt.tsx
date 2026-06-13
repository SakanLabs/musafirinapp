import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Receipt } from 'lucide-react';
import { authService } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { apiClient, API_ENDPOINTS } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useInvoices, usePayInvoice, type Invoice } from '@/lib/queries/invoices';

export const Route = createFileRoute('/create-receipt')({
    beforeLoad: async () => {
        // Check if user is authenticated
        const isAuthenticated = await authService.isAuthenticated();
        if (!isAuthenticated) {
            throw redirect({ to: '/login' });
        }

        // Check if user is finance
        const isFinance = await authService.isFinance();
        if (!isFinance) {
            throw redirect({ to: '/dashboard' });
        }
    },
    component: CreateReceiptPage,
});

const formSchema = z.object({
    invoiceId: z.string().min(1, 'Please select an invoice'),
    amount: z.number().min(0.01, 'Amount must be greater than 0'),
    method: z.enum(['bank_transfer', 'deposit', 'cash']),
    referenceNumber: z.string().optional(),
    description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function CreateReceiptPage() {
    const navigate = useNavigate();
    const { data: invoices, isLoading: isLoadingInvoices } = useInvoices();
    const payInvoiceMutation = usePayInvoice();
    const queryClient = useQueryClient();

    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

    // Filter for unpaid or partially paid invoices that can receive payments
    const eligibleInvoices = invoices?.filter(
        (inv: Invoice) => inv.status !== 'paid' && inv.status !== 'cancelled'
    ) || [];

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            invoiceId: '',
            amount: 0,
            method: 'bank_transfer',
            referenceNumber: '',
            description: '',
        },
    });

    const handleInvoiceSelect = (invoiceNumber: string) => {
        const invoice = eligibleInvoices.find((inv: Invoice) => inv.number === invoiceNumber);
        setSelectedInvoice(invoice || null);
        form.setValue('invoiceId', invoiceNumber);

        if (invoice) {
            // Calculate remaining balance dynamically based on payments array in meta if possible
            // Or fallback to the total amount by default
            const payments = (invoice.bookingMeta as Record<string, any>)?.payments || [];
            const paidSoFar = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
            const remainingBalance = Math.max(parseFloat(invoice.amount) - paidSoFar, 0);

            form.setValue('amount', remainingBalance);
        } else {
            form.setValue('amount', 0);
        }
    };

    const onSubmit = async (values: FormValues) => {
        try {
            const invoice = eligibleInvoices.find((inv: Invoice) => inv.number === values.invoiceId);
            if (!invoice) throw new Error("Invoice not found");

            if (invoice.number.startsWith('INV-')) {
                await payInvoiceMutation.mutateAsync({
                    id: invoice.id.toString(),
                    method: values.method,
                    amount: values.amount,
                    referenceNumber: values.referenceNumber,
                    description: values.description,
                });
            } else if (invoice.number.startsWith('TI-')) {
                await apiClient.post(API_ENDPOINTS.TRANSPORTATION_RECEIPT(invoice.bookingId), {
                    method: values.method,
                    amount: values.amount,
                    referenceNumber: values.referenceNumber,
                    description: values.description,
                });
                queryClient.invalidateQueries({ queryKey: ['receipts'] });
            } else if (invoice.number.startsWith('SO-')) {
                await apiClient.post(API_ENDPOINTS.SERVICE_ORDER_RECEIPT(invoice.bookingId), {
                    method: values.method,
                    amount: values.amount,
                    referenceNumber: values.referenceNumber,
                    description: values.description,
                });
                queryClient.invalidateQueries({ queryKey: ['receipts'] });
            } else {
                throw new Error("Unknown invoice type selected");
            }

            toast.success('Payment recorded and receipt generated successfully!');
            navigate({ to: '/receipts' });
        } catch (error: any) {
            toast.error(error.message || 'Failed to generate receipt. Please try again.');
        }
    };

    if (isLoadingInvoices) {
        return (
            <PageLayout title="Create Receipt" subtitle="Log a payment to generate a new receipt">
                <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            </PageLayout>
        );
    }

    return (
        <PageLayout
            title="Create Receipt"
            subtitle="Catat pembayaran invoice untuk menerbitkan kwitansi resmi secara otomatis"
            showBackButton
        >
            <div className="max-w-xl mx-auto">
                <div className="border border-[#e5e7eb] rounded-xl bg-white shadow-none p-4 md:p-6">
                    <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-zinc-100">
                        <Receipt className="h-5 w-5 text-zinc-500" />
                        <div>
                            <h2 className="text-sm font-bold text-[#111111] uppercase tracking-wider">Receipt Specifications</h2>
                            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">Pilih invoice dan masukkan jumlah pembayaran diterima</p>
                        </div>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                            <FormField
                                control={form.control}
                                name="invoiceId"
                                render={({ field }: { field: any }) => (
                                    <FormItem className="space-y-1.5">
                                        <FormLabel className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pilih Invoice *</FormLabel>
                                        <Select
                                            onValueChange={handleInvoiceSelect}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full">
                                                    <SelectValue placeholder="Pilih invoice tertunda..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="bg-white border border-[#e5e7eb] rounded-lg shadow-md">
                                                {eligibleInvoices.length === 0 ? (
                                                    <SelectItem value="none" disabled className="text-zinc-400 text-xs">Tidak ada invoice tertunda</SelectItem>
                                                ) : (
                                                    eligibleInvoices.map((inv: Invoice) => (
                                                        <SelectItem key={inv.number} value={inv.number} className="text-zinc-800 text-xs focus:bg-zinc-50 focus:text-black">
                                                            {inv.number} — {inv.clientName} (Booking: {inv.bookingCode})
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage className="text-rose-500 text-xs font-semibold" />
                                    </FormItem>
                                )}
                            />

                            {selectedInvoice && (
                                <div className="bg-zinc-50/50 border border-zinc-150 rounded-lg p-3.5 flex justify-between items-center text-xs">
                                    <div>
                                        <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Total Tagihan Invoice</span>
                                        <span className="font-extrabold text-zinc-950">{formatCurrency(selectedInvoice.amount, selectedInvoice.currency)}</span>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Status Pembayaran</span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${(selectedInvoice.bookingPaymentStatus || selectedInvoice.status)?.toLowerCase() === 'partial'
                                            ? 'bg-amber-50 text-amber-700 border-amber-200/50'
                                            : 'bg-rose-50 text-rose-700 border-rose-200/50'
                                            }`}>
                                            {selectedInvoice.bookingPaymentStatus || selectedInvoice.status}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }: { field: any }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Jumlah Pembayaran Diterima *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                                    className="h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full"
                                                />
                                            </FormControl>
                                            <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">Otomatis terisi sisa tagihan</p>
                                            <FormMessage className="text-rose-500 text-xs font-semibold" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="method"
                                    render={({ field }: { field: any }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormLabel className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Metode Pembayaran *</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full">
                                                        <SelectValue placeholder="Pilih metode..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-white border border-[#e5e7eb] rounded-lg shadow-md">
                                                    <SelectItem value="bank_transfer" className="text-zinc-800 text-xs focus:bg-zinc-50 focus:text-black">Bank Transfer</SelectItem>
                                                    <SelectItem value="cash" className="text-zinc-800 text-xs focus:bg-zinc-50 focus:text-black">Cash</SelectItem>
                                                    <SelectItem value="deposit" className="text-zinc-800 text-xs focus:bg-zinc-50 focus:text-black">Client Deposit</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage className="text-rose-500 text-xs font-semibold" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="referenceNumber"
                                    render={({ field }: { field: any }) => (
                                        <FormItem className="md:col-span-2 space-y-1.5">
                                            <FormLabel className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nomor Referensi / Bukti Transfer (Opsional)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Contoh: TRF-123456 atau Ref Name"
                                                    {...field}
                                                    className="h-10 border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full"
                                                />
                                            </FormControl>
                                            <FormMessage className="text-rose-500 text-xs font-semibold" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }: { field: any }) => (
                                        <FormItem className="md:col-span-2 space-y-1.5">
                                            <FormLabel className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Catatan Tambahan (Opsional)</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Catatan detail transaksi atau keterangan tambahan..."
                                                    {...field}
                                                    className="resize-none min-h-[80px] border-[#e5e7eb] rounded-lg bg-white text-sm font-medium text-zinc-950 focus:border-[#111111] focus:ring-1 focus:ring-[#111111] shadow-none w-full"
                                                />
                                            </FormControl>
                                            <FormMessage className="text-rose-500 text-xs font-semibold" />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="flex justify-end items-center space-x-2.5 pt-4 border-t border-zinc-100 mt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => navigate({ to: '/receipts' })}
                                    className="h-9 px-4 border-[#e5e7eb] text-zinc-700 hover:bg-gray-50 hover:text-black flex items-center rounded-md font-semibold text-xs bg-white shadow-none"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={payInvoiceMutation.isPending || eligibleInvoices.length === 0}
                                    className="bg-[#111111] hover:bg-[#242424] text-white h-9 px-4 rounded-md text-xs font-semibold transition-colors border border-transparent shadow-none"
                                >
                                    {payInvoiceMutation.isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin text-white" />
                                            Menerbitkan...
                                        </>
                                    ) : (
                                        'Generate Receipt'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </div>
        </PageLayout>
    );
}
