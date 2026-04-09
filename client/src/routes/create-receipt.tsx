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

        // Check if user is admin
        const isAdmin = await authService.isAdmin();
        if (!isAdmin) {
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
            } else if (invoice.number.startsWith('SOI-')) {
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
            subtitle="Log a payment against an invoice to auto-generate a receipt PDF"
            showBackButton
        >
            <div className="max-w-3xl mx-auto">
                <Card className="p-6">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="bg-purple-100 p-3 rounded-full">
                            <Receipt className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Receipt Details</h2>
                            <p className="text-sm text-gray-500">Select an invoice and enter the received amount</p>
                        </div>
                    </div>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                            <FormField
                                control={form.control}
                                name="invoiceId"
                                render={({ field }: { field: any }) => (
                                    <FormItem>
                                        <FormLabel>Select Invoice *</FormLabel>
                                        <Select
                                            onValueChange={handleInvoiceSelect}
                                            value={field.value}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Choose an unpaid invoice" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {eligibleInvoices.length === 0 ? (
                                                    <SelectItem value="none" disabled>No pending invoices available</SelectItem>
                                                ) : (
                                                    eligibleInvoices.map((inv: Invoice) => (
                                                        <SelectItem key={inv.number} value={inv.number}>
                                                            {inv.number} - {inv.clientName} (Booking: {inv.bookingCode})
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {selectedInvoice && (
                                <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center text-sm border border-gray-100">
                                    <div>
                                        <span className="text-gray-500 block">Total Invoice Amount</span>
                                        <span className="font-semibold text-gray-900">{formatCurrency(selectedInvoice.amount, selectedInvoice.currency)}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-gray-500 block">Current Status</span>
                                        <span className={`font-semibold uppercase ${selectedInvoice.bookingPaymentStatus === 'partial' ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {selectedInvoice.bookingPaymentStatus || selectedInvoice.status}
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="amount"
                                    render={({ field }: { field: any }) => (
                                        <FormItem>
                                            <FormLabel>Amount Received *</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    {...field}
                                                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                                />
                                            </FormControl>
                                            <p className="text-xs text-gray-500">Defaults to remaining balance</p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="method"
                                    render={({ field }: { field: any }) => (
                                        <FormItem>
                                            <FormLabel>Payment Method *</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select method" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                                    <SelectItem value="cash">Cash</SelectItem>
                                                    <SelectItem value="deposit">Client Deposit</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="referenceNumber"
                                    render={({ field }: { field: any }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>Reference Number (Optional)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. TRF-123456" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }: { field: any }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>Notes (Optional)</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Any additional details for the receipt" {...field} className="resize-none" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => navigate({ to: '/receipts' })}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={payInvoiceMutation.isPending || eligibleInvoices.length === 0}
                                >
                                    {payInvoiceMutation.isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        'Generate Receipt'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </Card>
            </div>
        </PageLayout>
    );
}
