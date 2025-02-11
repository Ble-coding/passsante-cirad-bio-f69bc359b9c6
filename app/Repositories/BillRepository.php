<?php

namespace App\Repositories;

use App\Models\Accountant;
use App\Models\Bill;
use App\Models\BillItems;
use App\Models\Doctor;
use App\Models\Medicine;
use App\Models\Notification;
use App\Models\Package;
use App\Models\Patient;
use App\Models\PatientAdmission;
use App\Models\Receptionist;
use App\Models\Setting;
use App\Models\User;
use Arr;
use Carbon\Carbon;
use Exception;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Validator;

/**
 * Class BillRepository
 *
 * @version February 13, 2020, 9:47 am UTC
 */
class BillRepository extends BaseRepository
{
    /**
     * @var array
     */
    protected $fieldSearchable = [
        'patient_id',
        'bill_date',
        'amount',
    ];

    /**
     * Return searchable fields
     */
    public function getFieldsSearchable(): array
    {
        return $this->fieldSearchable;
    }

    /**
     * Configure the Model
     **/
    public function model()
    {
        return Bill::class;
    }

    /**
     * @return mixed
     */
    public function getSyncList($isEditScreen)
    {
        $data['associateMedicines'] = $this->getAssociateMedicinesList();
        $data['patientAdmissionIds'] = $this->getPatientAdmissionIdList($isEditScreen);
        ksort($data['patientAdmissionIds']);

        return $data;
    }

    public function getPatientList()
    {
        /** @var Patient $patients */
        $patients = Patient::with('patientUser')->get()->where('patientUser.status', '=', 1)->pluck('patientUser.full_name', 'id')->sort();

        return $patients;
    }

    public function getAssociateMedicinesList(): array
    {
        $result = Medicine::orderBy('name', 'asc')->get()->pluck('name', 'id')->toArray();
        $medicines = [];
        foreach ($result as $key => $item) {
            $medicines[] = [
                'key' => $key,
                'value' => $item,
            ];
        }

        return $medicines;
    }

    public function getMedicinesList(): array
    {
        $medicine = Medicine::orderBy('name', 'asc')->get()->pluck('name', 'id')->toArray();
        $selectOption = ['0' => 'Select Medicine'];
        $medicine = $selectOption + $medicine;

        return $medicine;
    }

    public function getPatientAdmissionIdList($isEditScreen = false): array
    {
        /** @var PatientAdmission $patientAdmissions */
        $patientAdmissions = PatientAdmission::with('patient.patientUser')->where('status', '=', 1);
        $existingPatientAdmissionIds = Bill::pluck('patient_admission_id')->toArray();

        if ($isEditScreen) {
            $patientAdmissionsResults = $patientAdmissions->whereIn('patient_admission_id',
                $existingPatientAdmissionIds)->get();
        } else {
            $patientAdmissionsResults = $patientAdmissions->whereNotIn('patient_admission_id',
                $existingPatientAdmissionIds)->get();
        }

        $result = [];
        foreach ($patientAdmissionsResults as $patientAdmissionsResult) {
            $result[$patientAdmissionsResult->patient_admission_id] = $patientAdmissionsResult->patient_admission_id.' '.$patientAdmissionsResult->patient->patientUser->full_name;
        }

        return $result;
    }

    public function saveBill(array $input): Bill
    {
        $billItemInputArray = Arr::only($input, ['item_name', 'qty', 'price']);
        $input['bill_id'] = Bill::generateUniqueBillId();
        /** @var Bill $bill */
        $bill = $this->create($input);
        $totalAmount = 0;

        $billItemInput = $this->prepareInputForBillItem($billItemInputArray);
        foreach ($billItemInput as $key => $data) {
            $validator = Validator::make($data, BillItems::$rules);

            if ($validator->fails()) {
                throw new UnprocessableEntityHttpException($validator->errors()->first());
            }

            $data['amount'] = $data['price'] * $data['qty'];
            $totalAmount += $data['amount'];

            /** @var BillItems $billItem */
            $billItem = new BillItems($data);
            $bill->billItems()->save($billItem);
        }
        $bill->amount = $totalAmount;
        $bill->save();

        return $bill;
    }

    public function prepareInputForBillItem(array $input): array
    {
        $items = [];
        foreach ($input as $key => $data) {
            foreach ($data as $index => $value) {
                $items[$index][$key] = $value;
                if (! (isset($items[$index]['price']) && $key == 'price')) {
                    continue;
                }
                $items[$index]['price'] = removeCommaFromNumbers($items[$index]['price']);
            }
        }

        return $items;
    }

    /**
     * @throws Exception
     */
    public function updateBill(int $billId, array $input): Bill
    {
        $billItemInputArr = Arr::only($input, ['item_name', 'qty', 'price', 'id']);

        /** @var Bill $bill */
        $bill = $this->update($input, $billId);
        $totalAmount = 0;

        $billItem = BillItems::whereBillId($billId);
        $billItem->delete();

        $billItemInput = $this->prepareInputForBillItem($billItemInputArr);
        foreach ($billItemInput as $key => $data) {
            $validator = Validator::make($data, BillItems::$rules);

            if ($validator->fails()) {
                throw new UnprocessableEntityHttpException($validator->errors()->first());
            }

            $data['amount'] = $data['price'] * $data['qty'];
            $billItemInput[$key] = $data;
            $totalAmount += $data['amount'];
        }
        /** @var BillItemsRepository $billItemRepo */
        $billItemRepo = app(BillItemsRepository::class);
        $billItemRepo->updateBillItem($billItemInput, $bill->id);

        $bill->amount = $totalAmount;
        $bill->save();

        return $bill;
    }

    /**
     * @return mixed
     */
    public function patientAdmissionDetails($inputs)
    {
        $patientAdmissionId = $inputs['patient_admission_id'];
        $patientAdmission = PatientAdmission::wherePatientAdmissionId($patientAdmissionId)->first();
        $data['patientDetails'] = $patientAdmission->patient->patientUser;
        $data['doctorName'] = $patientAdmission->doctor->doctorUser->full_name;
        $admissionDate = Carbon::parse($patientAdmission->admission_date);
        $dischargeDate = Carbon::parse($patientAdmission->discharge_date);
        $patientAdmission->totalDays = $admissionDate->diffInDays($dischargeDate) + 1;
        $patientAdmission->insuranceName = isset($patientAdmission->insurance->name) ? $patientAdmission->insurance->name : '';

        if (isset($patientAdmission->package_id)) {
            $package = Package::with('packageServicesItems.service')->findOrFail($patientAdmission->package_id);
            $data['package'] = $package;
        } else {
            $data['package'] = '';
        }
        $data['admissionDetails'] = $patientAdmission;

        if (isset($inputs['editBillId'])) {
            $billGet = Bill::with('billItems')->wherePatientAdmissionId($inputs['patient_admission_id'])->get();
            if (count($billGet) > 0) {
                $data['billItems'] = BillItems::whereBillId($billGet[0]->id)->get();
            } else {
                $data['billItems'] = '';
            }
        }

        return $data;
    }

    /**
     * @return mixed
     */
    public function getSyncListForCreate()
    {
        $data['setting'] = Setting::all()->pluck('value', 'key')->toArray();

        return $data;
    }

    /**
     * @return mixed
     */
    public function getSyncListForCreateForPDF()
    {
        $data['setting'] = Setting::whereTenantId(getLoggedInUser()->tenant_id)->pluck('value', 'key')->toArray();;

        return $data;
    }

    public function saveNotification(array $input)
    {
        $patient = Patient::with('patientUser')->where('id', $input['patient_id'])->first();
        $doctor = Doctor::with('doctorUser')->get()->where('doctorUser.full_name', $input['doctor_id'])->first();
        $receptionists = Receptionist::pluck('user_id', 'id')->toArray();
        $accountants = Accountant::pluck('user_id', 'id')->toArray();
        $userIds = [
            $patient->user_id => Notification::NOTIFICATION_FOR[Notification::PATIENT],
            $doctor->user_id => Notification::NOTIFICATION_FOR[Notification::DOCTOR],
        ];

        foreach ($receptionists as $key => $userId) {
            $userIds[$userId] = Notification::NOTIFICATION_FOR[Notification::RECEPTIONIST];
        }

        foreach ($accountants as $key => $userId) {
            $userIds[$userId] = Notification::NOTIFICATION_FOR[Notification::ACCOUNTANT];
        }
        $adminUser = User::role('Admin')->first();
        $allUsers = $userIds + [$adminUser->id => Notification::NOTIFICATION_FOR[Notification::ADMIN]];
        $users = getAllNotificationUser($allUsers);

        foreach ($users as $key => $notification) {
            if ($notification == Notification::NOTIFICATION_FOR[Notification::PATIENT]) {
                $title = $patient->patientUser->full_name.' your bills has been created.';
            } else {
                $title = $patient->patientUser->full_name.' bills has been created.';
            }

            addNotification([
                Notification::NOTIFICATION_TYPE['Bills'],
                $key,
                $notification,
                $title,
            ]);
        }
    }
}
