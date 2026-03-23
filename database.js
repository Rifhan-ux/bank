// database.js
const SUPABASE_URL = 'https://tshriuijfhsmylbliyjv.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_HrcKkkqNI19TaVvvhGXfnQ_H78uS9tm';

class SMPSupabase {
    constructor() {
        this.db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    async init() {
        console.log('☁️ เชื่อมต่อ SMP BANK Cloud เรียบร้อย');
        return true;
    }

    // ==================== MEMBER OPERATIONS ====================
        async getAllMembers() {
            const { data, error } = await this.db.from('members').select('*').order('name');
            if (error) throw error;
            return data.map(m => ({
                ...m,
                qrCodeData: m.qrcodedata,
                pin: m.pin,
                phone: m.phone,
                profileImage: m.profileimage
            }));
        }

    async getMemberById(id) {
        const { data, error } = await this.db
            .from('members')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;

        return {
            ...data,
            qrCodeData: data.qrcodedata,
            pin: data.pin,
            phone: data.phone,
            profileImage: data.profileimage
        };
    }

    async addMember(member) {
            const dataForDB = {
                id: member.id,
                name: member.name,
                qrcodedata: member.qrCodeData,
                pin: member.pin,      // เพิ่ม PIN
                phone: member.phone,  // เพิ่มเบอร์โทร
                createdat: member.createdAt || new Date().toISOString()
            };
            const { error } = await this.db.from('members').insert([dataForDB]);
            if (error) throw error;
            return true;
        }

    async updateMember(id, updates) {
        const dataForDB = {};
        if (typeof updates.name === 'string') dataForDB.name = updates.name;
        if (typeof updates.phone === 'string') dataForDB.phone = updates.phone;
        if (typeof updates.qrCodeData === 'string') dataForDB.qrcodedata = updates.qrCodeData;
        if (typeof updates.profileImage === 'string') dataForDB.profileimage = updates.profileImage;
        if (Object.keys(dataForDB).length === 0) return true;

        const { error } = await this.db.from('members').update(dataForDB).eq('id', id);
        if (error) throw error;
        return true;
    }

    // ==================== DEBT OPERATIONS ====================
    async getAllDebts() {
        const { data, error } = await this.db.from('debts').select('*');
        if (error) throw error;
        // ล่าม: แปลงตัวเล็กใน DB กลับเป็นตัวใหญ่ให้ UI
        return data.map(d => ({
            ...d,
            debtorId: d.debtorid,
            creditorId: d.creditorid,
            creditorName: d.creditorname,
            createdAt: d.createdat
        }));
    }

    async getMemberSummary(memberId) {
        const allDebts = await this.getAllDebts();
        const memberDebts = allDebts.filter(d => d.debtorId === memberId && d.status === 'confirmed');
        const total = memberDebts.reduce((sum, d) => sum + Number(d.amount), 0);
        return { totalDebt: total, debts: memberDebts };
    }

    async getDebtsByStatus(status) {
    // 1. ดึงตรงจากตาราง debts โดยกรองตาม status (เช่น 'pending')
    const { data, error } = await this.db
        .from('debts')
        .select('*')
        .eq('status', status);

    if (error) {
        console.error("❌ ดึงหนี้ไม่สำเร็จ:", error.message);
        throw error;
    }

    // 2. 🔥 สำคัญมาก: แปลงชื่อจากตัวเล็กใน DB (debtorid) 
    // กลับเป็นชื่อที่ UI ใน index.html ใช้ (debtorId)
    return data.map(d => ({
        ...d,
        debtorId: d.debtorid,       // แปลงเพื่อให้ d.debtorId === memberId ทำงานได้
        creditorId: d.creditorid,
        creditorName: d.creditorname,
        createdAt: d.createdat
    }));
}

    async getDebtById(id) {
        const allDebts = await this.getAllDebts();
        return allDebts.find(d => d.id === id);
    }

    async addDebt(debt) {
    const dataForDB = {
        id: debt.id,
        title: debt.title,
        amount: debt.amount,
        debtorid: debt.debtorId,      // เช็คว่าสะกดตรงกับที่ส่งมา (I ใหญ่)
        creditorid: debt.creditorId,  // เช็คว่าสะกดตรงกับที่ส่งมา (I ใหญ่)
        creditorname: debt.creditorName,
        status: 'pending',
        createdat: debt.createdAt || new Date().toISOString()
    };

    const { error } = await this.db.from('debts').insert([dataForDB]);
    if (error) throw error;
    return true;
}

    async updateDebt(debt) {
        const { error } = await this.db
            .from('debts')
            .update({ status: debt.status })
            .eq('id', debt.id);
        if (error) throw error;
        return true;
    }

    // ==================== PAYMENT OPERATIONS ====================
    async paySingleDebt(debtId, slipImage, paidBy) {
        const debt = await this.getDebtById(debtId);
        const paymentData = {
            debtid: debtId,
            title: debt.title,
            amount: debt.amount,
            paidby: paidBy,
            paidto: debt.creditorId,
            paidtoname: debt.creditorName,
            slipimage: slipImage,
            paidat: new Date().toISOString()
        };

        const { error: pError } = await this.db.from('payments').insert([paymentData]);
        if (pError) throw pError;

        // เปลี่ยนสถานะเป็น paid เพื่อคงประวัติหนี้และกันข้อมูลค้าง
        const { error: dError } = await this.db.from('debts').update({ status: 'paid' }).eq('id', debtId);
        if (dError) throw dError;

        return { success: true, message: "ชำระเงินเรียบร้อย" };
    }

    async getAllPayments() {
        const { data, error } = await this.db.from('payments').select('*');
        if (error) throw error;
        return data.map(p => ({
            ...p,
            paidToName: p.paidtoname,
            slipImage: p.slipimage,
            paidAt: p.paidat
        }));
    }

    // ส่วนของ Group Payment (ถ้ามี)
    async getPaymentGroups() { return []; } 
}

const dbManager = new SMPSupabase();
