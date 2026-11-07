import { useEffect, useState } from 'react';
import api, { errMsg } from '../api';
import { useAuth } from '../AuthContext';

const rupee = (v) =>
  '\u20B9' + Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Bills() {
  const { user } = useAuth();
  const isStaff = user.role === 'ADMIN' || user.role === 'STAFF';
  const isCustomer = user.role === 'CUSTOMER';

  const [bills, setBills] = useState([]);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState([]);
  const [readingId, setReadingId] = useState('');
  const [modal, setModal] = useState(null);
  const [method, setMethod] = useState('UPI');
  const [receipt, setReceipt] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const load = () => {
    api.get('/bills', { params: status ? { status } : {} })
      .then((r) => setBills(r.data)).catch((e) => flash('error', errMsg(e)));
    if (isStaff) {
      api.get('/bills/ungenerated').then((r) => setPending(r.data)).catch(() => {});
    }
  };

  useEffect(() => { load(); }, [status]);

  const generate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/bills/generate', { reading_id: readingId });
      flash('success', 'Bill generated: ' + rupee(data.total_amount) + ' (due ' + data.due_date + ')');
      setReadingId('');
      load();
    } catch (err) {
      flash('error', errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const openPay = (b) => { setMethod('UPI'); setReceipt(null); setModal({ type: 'pay', bill: b }); };

  const pay = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/payments', { bill_id: modal.bill.id, method });
      setReceipt(data);
      load();
    } catch (err) {
      flash('error', errMsg(err));
      setModal(null);
    } finally {
      setBusy(false);
    }
  };

  const closeModal = () => { setModal(null); setReceipt(null); };

  return (
    <div className={modal && modal.type === 'view' ? 'bill-open' : ''}>
      <h2>Bills</h2>
      {msg && <div className={'alert ' + msg.type}>{msg.text}</div>}

      {isStaff && (
        <form className="card" onSubmit={generate}>
          <h3 className="chart-title">Generate bill from a meter reading</h3>
          {pending.length === 0 ? (
            <p className="muted">All readings with consumption already have bills.</p>
          ) : (
            <div className="inline-form">
              <select value={readingId} required onChange={(e) => setReadingId(e.target.value)}>
                <option value="">Select a reading</option>
                {pending.map((p) => (
                  <option key={p.reading_id} value={p.reading_id}>
                    {p.customer_name} - {p.meter_number} - {p.reading_date} - {p.units_consumed} units
                  </option>
                ))}
              </select>
              <button className="btn" disabled={busy}>Generate bill</button>
            </div>
          )}
        </form>
      )}

      <div className="card section table-wrap">
        <div className="table-head">
          <h3 className="chart-title">{isCustomer ? 'My bills' : 'All bills'}</h3>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="inline-select">
            <option value="">All statuses</option>
            <option value="UNPAID">Unpaid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="PAID">Paid</option>
          </select>
        </div>
        <table>
          <thead>
            <tr>
              <th>Month</th>{!isCustomer && <th>Customer</th>}<th>Meter</th><th>Units</th>
              <th>Amount</th><th>Due date</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id}>
                <td>{b.billing_month.slice(0, 7)}</td>
                {!isCustomer && <td>{b.customer_name}</td>}
                <td>{b.meter_number}</td><td>{b.units}</td>
                <td>{rupee(b.total_amount)}</td><td>{b.due_date}</td>
                <td><span className={'tag ' + b.status}>{b.status}</span></td>
                <td className="actions">
                  <button className="btn secondary small" onClick={() => setModal({ type: 'view', bill: b })}>View</button>{' '}
                  {isCustomer && b.status !== 'PAID' && (
                    <button className="btn small" onClick={() => openPay(b)}>Pay now</button>
                  )}
                </td>
              </tr>
            ))}
            {bills.length === 0 && <tr><td colSpan="8" className="muted">No bills found</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && modal.type === 'view' && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>&#9889; PowerBill - Electricity Bill</h3>
            <div className="invoice">
              <div><span>Customer</span><b>{modal.bill.customer_name}</b></div>
              <div><span>Address</span><b>{modal.bill.address}</b></div>
              <div><span>Meter number</span><b>{modal.bill.meter_number}</b></div>
              <div><span>Billing month</span><b>{modal.bill.billing_month.slice(0, 7)}</b></div>
              <div><span>Units consumed</span><b>{modal.bill.units}</b></div>
              <div><span>Energy charge</span><b>{rupee(modal.bill.energy_charge)}</b></div>
              <div><span>Fixed charge</span><b>{rupee(modal.bill.fixed_charge)}</b></div>
              <div className="total"><span>Total amount</span><b>{rupee(modal.bill.total_amount)}</b></div>
              <div><span>Due date</span><b>{modal.bill.due_date}</b></div>
              <div><span>Status</span><b><span className={'tag ' + modal.bill.status}>{modal.bill.status}</span></b></div>
            </div>
            <div className="no-print modal-actions">
              <button className="btn" onClick={() => window.print()}>Print</button>{' '}
              {isCustomer && modal.bill.status !== 'PAID' && (
                <button className="btn" onClick={() => openPay(modal.bill)}>Pay now</button>
              )}{' '}
              <button className="btn secondary" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {modal && modal.type === 'pay' && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {!receipt ? (
              <>
                <h3>Pay bill</h3>
                <p>Amount payable: <b>{rupee(modal.bill.total_amount)}</b></p>
                <p className="muted">Month {modal.bill.billing_month.slice(0, 7)} - Meter {modal.bill.meter_number}</p>
                <label>Payment method (simulated)</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  <option value="NETBANKING">Net banking</option>
                </select>
                <div className="modal-actions">
                  <button className="btn" disabled={busy} onClick={pay}>
                    {busy ? 'Processing...' : 'Pay ' + rupee(modal.bill.total_amount)}
                  </button>{' '}
                  <button className="btn secondary" onClick={closeModal}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-green">&#10003; Payment successful</h3>
                <div className="invoice">
                  <div><span>Transaction ID</span><b>{receipt.transaction_id}</b></div>
                  <div><span>Amount</span><b>{rupee(receipt.amount)}</b></div>
                  <div><span>Method</span><b>{receipt.method}</b></div>
                  <div><span>Status</span><b>{receipt.status}</b></div>
                </div>
                <div className="modal-actions">
                  <button className="btn" onClick={closeModal}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
