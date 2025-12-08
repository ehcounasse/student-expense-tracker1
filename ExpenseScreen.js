import React, { useEffect, useState, useMemo} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

export default function ExpenseScreen() {
  const db = useSQLiteContext();

  const [expenses, setExpenses] = useState([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [editingExpense, setEditingExpense] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');

  const loadExpenses = async () => {
    const rows = await db.getAllAsync(
      'SELECT id, amount, category, note, date FROM expenses ORDER BY date DESC, id DESC;'
    );
    setExpenses(rows);
  };
  const addExpense = async () => {
    const amountNumber = parseFloat(amount);

    if (isNaN(amountNumber) || amountNumber <= 0) {
      // Basic validation: ignore invalid or non-positive amounts
      return;
    }

    const trimmedCategory = category.trim();
    const trimmedNote = note.trim();

    if (!trimmedCategory) {
      // Category is required
      return;
    }

    const today = new Date();
    const isoDate = today.toISOString().slice(0,10);

    await db.runAsync(
      'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?);',
      [amountNumber, trimmedCategory, trimmedNote || null, isoDate]
    );

    setAmount('');
    setCategory('');
    setNote('');

    loadExpenses();
  };


  const deleteExpense = async (id) => {
    await db.runAsync('DELETE FROM expenses WHERE id = ?;', [id]);
    loadExpenses();
  };

  function isInCurrentWeek(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return false;
    
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setHours(0,0,0,0);
    startOfWeek.setDate(today.getDate() -today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate()+ 7);
    return d>= startOfWeek && d < endOfWeek;
  }

  function isInCurrentMonth(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return false;
    const today = new Date();
    return (
      d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()
    );
  }

  const filteredExpenses = useMemo(() => {
    if (filter === 'ALL') return expenses;
    if (filter === 'WEEK'){
      return expenses.filter((e) => isInCurrentWeek(e.date));
    }
    if (filter === 'MONTH') {
      return expenses.filter((e) => isInCurrentMonth(e.date));
    }
    return expenses
  }, [expenses, filter]);

  const totalSpending = useMemo(() => {
    return filteredExpenses.reduce(
      (sum, e) => sum + (e.amount ? Number(e.amount) : 0), 0
    );
  }, [filteredExpenses]);

  const totalsByCategory = useMemo(() => {
    const map = {};
    for (const e of filteredExpenses) {
      const cat = e.category || 'Uncategorized';
      const amt = e.amount ? Number(e.amount) : 0;
      map[cat] = (map[cat] || 0) + amt;
    }
    return map;
  }, [filteredExpenses]);

  const chartData = useMemo(() => {
    const entries = Object.entries(totalsByCategory)
    const amounts = entries.map(([, amt])=> amt);
    const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
    return { entries, maxAmount };
  }, [totalsByCategory]);

  const filterLabel =
  filter === "ALL"
  ? "ALL"
  : filter === 'WEEK'
  ? "This Week"
  : "This Month";

  const startEdit = (expense) => {
    setEditingExpense(expense);
    setEditAmount(String(expense.amount));
    setEditCategory(expense.category);
    setEditNote(expense.note || '');
    if (expense.date && expense.date.length >= 10) {
        setEditDate(expense.date.slice(0,10));
    } else {
        setEditDate('');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    const amountNumber = parseFloat(editAmount);
    if (isNaN(amountNumber) || amountNumber <= 0) {alert('Please enter a valid positive amount.');
        return;
    }
    const trimmedCategory = editCategory.trim();
    if (!trimmedCategory) {
        alert ('Category is required');
        return;
    }
    const trimmedDate = editDate.trim();
    if (!trimmedDate) {
        alert ('Date is required (YYYY-MM-DD).');
        return;
    }
    await db.runAsync(
        `Update expenses
        SET amount = ?, category = ?, note = ?, date = ?
        WHERE id = ?`,
        [
            amountNumber,
            trimmedCategory,
            editNote.trim() || null,
            trimmedDate,
            editingExpense.id,
        ]
    );
    setEditingExpense(null);
    loadExpenses();
  }

  const renderExpense = ({ item }) => (
    <View style={styles.expenseRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseAmount}>
          ${Number(item.amount).toFixed(2)}
        </Text>
        <Text style={styles.expenseCategory}>{item.category}</Text>
        {item.note ? <Text style={styles.expenseNote}>{item.note}</Text> : null}
        <Text style={styles.expenseNote}>
          {item.date ? item.date.slice(0, 10) : ''}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <TouchableOpacity onPress={() => startEdit(item)}>
          <Text style={{ color: '#60a5fa', marginBottom: 4 }}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteExpense(item.id)}>
          <Text style={styles.delete}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );



  useEffect(() => {
    async function setup() {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          note TEXT,
          date TEXT NOT NULL
        );
      `);

      await loadExpenses();
    }

    setup();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Student Expense Tracker</Text>
      {/* Filter buttons */}
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'ALL' && styles.filterButtonActive,
          ]}
          onPress={() => setFilter('ALL')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === 'ALL' && styles.filterButtonTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'WEEK' && styles.filterButtonActive,
          ]}
          onPress={() => setFilter('WEEK')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === 'WEEK' && styles.filterButtonTextActive,
            ]}
          >
            This Week
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === 'MONTH' && styles.filterButtonActive,
          ]}
          onPress={() => setFilter('MONTH')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filter === 'MONTH' && styles.filterButtonTextActive,
            ]}
          >
            This Month
          </Text>
        </TouchableOpacity>
      </View>

      {/* Totals */}
      <View style={styles.totalsBox}>
        <Text style={{ color: '#e5e7eb', fontWeight: '600' }}>
          Total Spending ({filterLabel}):
        </Text>
        <Text style={{ color: '#fbbf24', fontSize: 20, fontWeight: '700' }}>
          ${totalSpending.toFixed(2)}
        </Text>

        <Text
          style={{ color: '#e5e7eb', fontWeight: '600', marginTop: 8 }}
        >
          By Category ({filterLabel}):
        </Text>

        {Object.keys(totalsByCategory).length === 0 ? (
          <Text style={styles.empty}>No expenses for this filter.</Text>
        ) : (
          Object.entries(totalsByCategory).map(([cat, amt]) => (
            <Text
              key={cat}
              style={{ color: '#e5e7eb', fontSize: 13 }}
            >
              • {cat}: ${amt.toFixed(2)}
            </Text>
          ))
        )}
      </View>
        <View style={styles.chartContainer}>
          <Text style = {styles.chartTitle}>
            Spending by Category ({filterLabel})
          </Text>
          <Text style = {styles.chartAxisLabel}>
            Amount ($)
          </Text>
          {chartData.entries.length === 0 ? (
            <Text style = {styles.empty}>No data to display.</Text>
          ) : (
            <ScrollView horizontal 
            contentContainerStyle={styles.chartScrollContent} 
            showsHorizontalScrollIndicator={false}
            >
            <View style = {styles.chartBarsRow}>
              {chartData.entries.map(([cat, amt])=> {
                const barHeight =
                chartData.maxAmount > 0 
                ? (amt / chartData.maxAmount) * 120 
                : 0;
                return (
                  <View key = {cat} style = {styles.barItem}>
                  <View style = {[styles.bar, {height: barHeight}]} />
                  <Text style = {styles.barValue}>${amt.toFixed(0)}</Text>
                  <Text style = {styles.barLabel} numberOfLines={1}>
                    {cat}
                  </Text>
                  </View>
                );
              })}
            </View>
            </ScrollView>
        )}
        <Text style = {styles.chartXAxisLabel}>Categories</Text>
        </View>
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Amount (e.g. 12.50)"
          placeholderTextColor="#9ca3af"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <TextInput
          style={styles.input}
          placeholder="Category (Food, Books, Rent...)"
          placeholderTextColor="#9ca3af"
          value={category}
          onChangeText={setCategory}
        />
        <TextInput
          style={styles.input}
          placeholder="Note (optional)"
          placeholderTextColor="#9ca3af"
          value={note}
          onChangeText={setNote}
        />
        <Button title="Add Expense" onPress={addExpense} />
      </View>

      <FlatList
        data={filteredExpenses}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        ListEmptyComponent={
          <Text style={styles.empty}>No expenses yet.</Text>
        }
      />

      <Text style={styles.footer}>
        Enter your expenses and they’ll be saved locally with SQLite.
      </Text>
            <Modal
        visible={!!editingExpense}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingExpense(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.heading}>Edit Expense</Text>

            <TextInput
              style={styles.input}
              placeholder="Amount"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={editAmount}
              onChangeText={setEditAmount}
            />
            <TextInput
              style={styles.input}
              placeholder="Category"
              placeholderTextColor="#9ca3af"
              value={editCategory}
              onChangeText={setEditCategory}
            />
            <TextInput
              style={styles.input}
              placeholder="Note (optional)"
              placeholderTextColor="#9ca3af"
              value={editNote}
              onChangeText={setEditNote}
            />
            <TextInput
              style={styles.input}
              placeholder="Date (YYYY-MM-DD)"
              placeholderTextColor="#9ca3af"
              value={editDate}
              onChangeText={setEditDate}
            />

            <View style={styles.modalButtons}>
              <Button title="Cancel" onPress={() => setEditingExpense(null)} />
              <Button title="Save" onPress={handleSaveEdit} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#111827' },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  form: {
    marginBottom: 16,
    gap: 8,
  },
  input: {
    padding: 10,
    backgroundColor: '#1f2937',
    color: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fbbf24',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#e5e7eb',
  },
  expenseNote: {
    fontSize: 12,
    color: '#9ca3af',
  },
  delete: {
    color: '#f87171',
    fontSize: 20,
    marginLeft: 12,
  },
  empty: {
    color: '#9ca3af',
    marginTop: 24,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
    fontSize: 12,
  },
    filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#374151',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterButtonText: {
    color: '#e5e7eb',
    fontSize: 13,
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  totalsBox: {
    backgroundColor: '#1f2937',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },

  chartContainer: {
    backgroundColor: '#1f2937',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  chartTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  chartAxisLabel: {
    color: '#e5e7eb',
    fontSize: 12,
    marginBottom: 8,
  },
  chartBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  chartScrollContent: {
    paddingVertical: 4,
  },
  barItem: {
    alignItems: 'center',
    marginHorizontal: 6,
  },
  bar: {
    width: 24,
    borderRadius: 6,
    backgroundColor: '#fbbf24',
  },
  barValue: {
    color: '#e5e7eb',
    fontSize: 10,
    marginTop: 4,
  },
  barLabel: {
    color: '#e5e7eb',
    fontSize: 10,
    marginTop: 2,
    maxWidth: 50,
    textAlign: 'center',
  },
  chartXAxisLabel: {
    color: '#e5e7eb',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});