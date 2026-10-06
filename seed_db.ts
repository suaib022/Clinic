import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const bdFirstNamesMale = ['Rahim', 'Karim', 'Safi', 'Rifat', 'Hasan', 'Ahmed', 'Kamal', 'Jamal', 'Rafiq', 'Tariq', 'Sakib', 'Tamim', 'Mushfiq', 'Mahmud', 'Arif', 'Asif', 'Rakib', 'Habib', 'Faisal', 'Zayed'];
const bdFirstNamesFemale = ['Fatema', 'Ayesha', 'Khadija', 'Sumaiya', 'Sadia', 'Tania', 'Nusrat', 'Mim', 'Jannat', 'Sonia', 'Ruma', 'Rina', 'Farhana', 'Sharmin', 'Mitu', 'Ritu', 'Nipa', 'Sabina', 'Salma', 'Shirin'];
const bdLastNames = ['Rahman', 'Islam', 'Hossain', 'Ahmed', 'Chowdhury', 'Khan', 'Sikder', 'Haque', 'Talukder', 'Mia', 'Mollah', 'Sheikh', 'Sarkar', 'Uddin', 'Ali'];

function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMobile() {
    const operators = ['17', '18', '19', '13', '15', '14'];
    const op = operators[getRandomInt(0, operators.length - 1)];
    const num = Math.floor(10000000 + Math.random() * 90000000);
    return `+880${op}${num}`;
}

function getRandomDate(start: Date, end: Date) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function seed() {
    console.log('Starting seed process...');
    
    // 1. Delete all patients, patient users, and appointments
    console.log('Deleting existing data...');
    // appointments and patients cascade? We should delete appointments first, then patients, then users
    await supabase.from('appointments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('patients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    const { data: patientUsers } = await supabase.from('users').select('id').eq('role', 'patient');
    if (patientUsers && patientUsers.length > 0) {
        for (const pu of patientUsers) {
            await supabase.auth.admin.deleteUser(pu.id);
        }
    }
    await supabase.from('users').delete().eq('role', 'patient');

    // 2. Create 25 Users with role 'patient'
    console.log('Creating users...');
    const numUsers = 25;
    const authUserIds = [];

    for (let i = 0; i < numUsers; i++) {
        const isMale = Math.random() > 0.5;
        const firstName = isMale ? bdFirstNamesMale[getRandomInt(0, bdFirstNamesMale.length - 1)] : bdFirstNamesFemale[getRandomInt(0, bdFirstNamesFemale.length - 1)];
        const lastName = bdLastNames[getRandomInt(0, bdLastNames.length - 1)];
        const fullName = `${firstName} ${lastName}`;
        const email = `${firstName.toLowerCase()}${getRandomInt(10, 9999)}@gmail.com`;

        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: '123456',
            email_confirm: true,
            user_metadata: { full_name: fullName }
        });

        if (authError || !authData.user) {
            console.error('Auth user error:', authError);
            continue;
        }

        await supabase.from('users').insert({
            id: authData.user.id,
            email,
            full_name: fullName,
            role: 'patient',
            phone: generateMobile()
        });

        authUserIds.push(authData.user.id);
    }

    // 3. Create 2-5 patients for each user
    console.log('Creating patients...');
    const allPatientIds = [];
    for (const authId of authUserIds) {
        const numPatients = getRandomInt(2, 5);
        for (let i = 0; i < numPatients; i++) {
            const isMale = Math.random() > 0.5;
            const firstName = isMale ? bdFirstNamesMale[getRandomInt(0, bdFirstNamesMale.length - 1)] : bdFirstNamesFemale[getRandomInt(0, bdFirstNamesFemale.length - 1)];
            const lastName = bdLastNames[getRandomInt(0, bdLastNames.length - 1)];
            const fullName = `${firstName} ${lastName}`;
            const title = isMale ? 'Mr.' : 'Ms.';
            const gender = isMale ? 'Male' : 'Female';
            const age = getRandomInt(3, 75);
            
            const dob = new Date();
            dob.setFullYear(dob.getFullYear() - age);
            dob.setMonth(getRandomInt(0, 11));
            dob.setDate(getRandomInt(1, 28));

            const generatedUhid = `UHID${Math.floor(10000000 + Math.random() * 90000000)}`;
            const mobile = generateMobile();

            const { data: patient, error: patientError } = await supabase.from('patients').insert({
                auth_user_id: authId,
                uhid: generatedUhid,
                full_name: fullName,
                title,
                gender,
                dob: dob.toISOString().split('T')[0],
                mobile_no: mobile,
                email: `${firstName.toLowerCase()}${getRandomInt(10, 9999)}@patients.clinic.local`
            }).select('id').single();

            if (patient) {
                allPatientIds.push(patient.id);
            } else {
                console.error('Patient error:', patientError);
            }
        }
    }

    // 4. Get Doctors
    const { data: doctors } = await supabase.from('doctors').select('id');
    if (!doctors || doctors.length === 0) {
        console.error('No doctors found!');
        return;
    }

    // 5. Create 50-60 appointments
    console.log('Creating appointments...');
    const numAppointments = getRandomInt(50, 60);
    const now = new Date();

    for (let i = 0; i < numAppointments; i++) {
        const isPast = Math.random() > 0.4; // 60% past, 40% future
        let aptDate;
        let status;
        
        if (isPast) {
            const pastStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            aptDate = getRandomDate(pastStart, now);
            const statuses = ['completed', 'completed', 'cancelled', 'no_show'];
            status = statuses[getRandomInt(0, statuses.length - 1)];
        } else {
            const futureEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
            aptDate = getRandomDate(now, futureEnd);
            status = 'scheduled'; // all future appointments are just scheduled
        }

        const doctorId = doctors[getRandomInt(0, doctors.length - 1)].id;
        const patientId = allPatientIds[getRandomInt(0, allPatientIds.length - 1)];
        
        // Pick a random slot time (e.g. 10:00, 11:30)
        const hour = getRandomInt(9, 17);
        const mins = Math.random() > 0.5 ? '00' : '30';
        const startTime = `${hour.toString().padStart(2, '0')}:${mins}:00`;

        const visitTypes = ['new', 'follow_up', 'report_review'];
        
        await supabase.from('appointments').insert({
            doctor_id: doctorId,
            patient_id: patientId,
            appointment_date: aptDate.toISOString().split('T')[0],
            start_time: startTime,
            status,
            visit_source: Math.random() > 0.5 ? 'online' : 'walk_in',
            visit_type: visitTypes[getRandomInt(0, visitTypes.length - 1)],
            is_priority: Math.random() > 0.8
        });
    }

    console.log(`Seed complete! Created ${numUsers} users, ${allPatientIds.length} patients, and ${numAppointments} appointments.`);
}

seed().catch(console.error);
