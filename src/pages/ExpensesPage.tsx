import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet, Plus, Trash2 } from "lucide-react";

const CATEGORIES = ["General", "Food Supplies", "Utilities", "Rent", "Salary", "Maintenance", "Other"];

const ExpensesPage = () => {
  const { user, hotelId } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("General");
  const [adding, setAdding] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const fetchExpenses = async () => {
    if (!hotelId) return;
    setLoading(true);
    const { data } = await supabase
      .from("daily_expenses")
      .select("*")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false })
      .limit(100);
    setExpenses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, [hotelId]);

  const addExpense = async () => {
    if (!description.trim() || !amount || !hotelId || !user) return;
    setAdding(true);
    const { error } = await supabase.from("daily_expenses").insert({
      hotel_id: hotelId, created_by: user.id,
      description: description.trim(), amount: parseFloat(amount),
      category, expense_date: today,
    });
    if (error) toast.error("Failed to add expense");
    else {
      toast.success("Expense added");
      setDescription(""); setAmount("");
      fetchExpenses();
    }
    setAdding(false);
  };

  const deleteExpense = async (id: string) => {
    const { error } = await supabase.from("daily_expenses").delete().eq("id", id);
    if (error) toast.error("Delete failed");
    else { toast.success("Deleted"); setExpenses(prev => prev.filter(e => e.id !== id)); }
  };

  const todayTotal = expenses.filter(e => e.expense_date === today).reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6" /> Expenses</h1>
        <Badge variant="outline" className="text-lg px-3">Today: ₹{todayTotal.toFixed(0)}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Add Expense</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-xs text-muted-foreground">Description</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Vegetables" />
            </div>
            <div className="space-y-1 w-28">
              <label className="text-xs text-muted-foreground">Amount (₹)</label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1 w-36">
              <label className="text-xs text-muted-foreground">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addExpense} disabled={adding || !description.trim() || !amount}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Expenses ({expenses.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left p-3 font-medium">Description</th>
                  <th className="text-left p-3 font-medium">Category</th>
                  <th className="text-right p-3 font-medium">Amount</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3 text-xs text-muted-foreground">{e.expense_date}</td>
                    <td className="p-3">{e.description}</td>
                    <td className="p-3"><Badge variant="outline">{e.category}</Badge></td>
                    <td className="p-3 text-right font-medium">₹{Number(e.amount).toFixed(0)}</td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteExpense(e.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No expenses yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpensesPage;
