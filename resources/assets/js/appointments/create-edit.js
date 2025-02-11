'use strict';

document.addEventListener('turbo:load', loadAppointmentCreateEdit)

function loadAppointmentCreateEdit() {

    if($('#appointmentForm').length || $('#editAppointmentForm').length){

        const appointmentPatientIdElement = $('#appointmentsPatientId')
        const appointmentDoctorIdElement = $('#appointmentDoctorId')
        const appointmentDepartmentIdElement = $('#appointmentDepartmentId')

        if(appointmentPatientIdElement.length){
            $('#appointmentsPatientId').select2({
                width: '100%',
            });
            $('#appointmentsPatientId').first().focus();
        }

        if(appointmentDoctorIdElement.length){
            $('#appointmentDoctorId').select2({
                width: '100%',
            })
        }

        if (appointmentDepartmentIdElement.length) {
            $('#appointmentDepartmentId').select2({
                width: '100%',
            })
        }

        var appointmentSelectedDate
        var appointmentIntervals
        var appointmentAlreadyCreateTimeSlot
        var appointmentBreakIntervals

        let opdDate = $('.opdDate').flatpickr({
            enableTime: false,
            // minDate: moment().subtract(1, 'days').format(),
            minDate: moment(new Date()).format('YYYY-MM-DD'),
            dateFormat: 'Y-m-d',
            locale: $('.userCurrentLanguage').val(),
            onChange: function (selectedDates, dateStr, instance) {
                if (!isEmpty(dateStr)) {
                    $('.doctor-schedule').css('display', 'none')
                    $('.error-message').css('display', 'none')
                    $('.available-slot-heading').css('display', 'none')
                    $('.color-information').css('display', 'none')
                    $('.available-slot').css('display', 'none')
                    $('.time-slot').remove()
                    if ($('#appointmentDepartmentId').val() == '') {
                        $('#createAppointmentErrorsBox').
                            show().
                            html(Lang.get('messages.appointment.please_select_doctor')+' '+Lang.get('messages.department'))
                        $('#createAppointmentErrorsBox').delay(5000).fadeOut()
                        $('.opdDate').val('')
                        opdDate.clear()
                        return false
                    } else if ($('#appointmentDoctorId').val() == '') {
                        $('#createAppointmentErrorsBox').
                            show().
                            html(Lang.get('messages.appointment.please_select_doctor'))
                        $('#createAppointmentErrorsBox').delay(5000).fadeOut()
                        $('.opdDate').val('')
                        opdDate.clear()
                        return false
                    }
                    var weekday = [
                        'Sunday',
                        'Monday',
                        'Tuesday',
                        'Wednesday',
                        'Thursday',
                        'Friday',
                        'Saturday']
                    var selected = new Date(dateStr)
                    let dayName = weekday[selected.getDay()]
                    appointmentSelectedDate = dateStr
                    //if dayName is blank, then ajax call not run.
                    if (dayName == null || dayName == '') {
                        return false
                    }

                    //get doctor schedule list with time slot.
                    $.ajax({
                        type: 'GET',
                        url: $('.doctorScheduleList').val(),
                        data: {
                            day_name: dayName,
                            doctor_id: appointmentDoctorId,
                            date:appointmentSelectedDate,
                        },
                        success: function (result) {
                            if (result.success) {
                                if (result.data != '') {
                                    if (result.data.scheduleDay.length != 0 && result.data.doctorHoliday.length == 0) {
                                        let availableFrom = '';
                                        if (moment(new Date()).format('YYYY-MM-DD') === dateStr) {
                                            availableFrom = moment().ceil(moment.duration( result.data.perPatientTime[0].per_patient_time).asMinutes()
                                                , 'minute');
                                            availableFrom = moment(availableFrom.toString()).format('H:mm:ss');
                                            // availableFrom = moment(new Date()).
                                            //     add(result.data.perPatientTime[0].per_patient_time,
                                            //         'minutes').
                                            //     format('H:mm:ss');
                                        } else {
                                            availableFrom = result.data.scheduleDay[0].available_from
                                        }

                                        var doctorStartTime = appointmentSelectedDate +
                                            ' ' +
                                            availableFrom
                                        var doctorEndTime = appointmentSelectedDate +
                                            ' ' +
                                            result.data.scheduleDay[0].available_to

                                        var doctorPatientTime = result.data.perPatientTime[0].per_patient_time
                                        //perPatientTime convert to Minute
                                        var a = doctorPatientTime.split(':') // split it at the colons
                                        var minutes = (+a[0]) * 60 + (+a[1]) // convert to minute
                                        //parse In

                                        var startTime = appointmentParseIn(
                                            doctorStartTime)
                                        var endTime = appointmentParseIn(
                                            doctorEndTime)
                                        //call to getTimeIntervals function
                                        appointmentIntervals = appointmentGetTimeIntervals(
                                            startTime, endTime,
                                            minutes)
                                        if(result.data.doctorBreak != null){
                                            for (var breakIndex = 0; breakIndex < result.data.doctorBreak.length; ++breakIndex) {
                                                    var startBreakTime = appointmentParseIn(appointmentSelectedDate+' '+result.data.doctorBreak[breakIndex].break_from)
                                                    var endBreakTime = appointmentParseIn(appointmentSelectedDate+' '+result.data.doctorBreak[breakIndex].break_to)
                                                    appointmentBreakIntervals = appointmentGetTimeIntervals(
                                                        startBreakTime, endBreakTime,
                                                        1)
                                                    appointmentIntervals = appointmentIntervals.filter(slot => !appointmentBreakIntervals.includes(slot));
                                                }
                                        }

                                        //if intervals array length is grater then 0 then process
                                        if (appointmentIntervals.length > 0) {
                                            $('.available-slot-heading').
                                                css('display', 'block')
                                            $('.color-information').
                                                css('display', 'block')
                                            $('.available-slot').
                                                css('display', 'block')
                                            var index
                                            let timeStlots = ''
                                            for (index = 0; index <
                                            appointmentIntervals.length; ++index) {
                                                let data = [
                                                    {
                                                        'index': index,
                                                        'timeSlot': appointmentIntervals[index],
                                                    }]
                                                var timeSlot = prepareTemplateRender(
                                                    '#appointmentSlotTemplate',
                                                    data)
                                                timeStlots += timeSlot
                                            }
                                            $('.available-slot').
                                                append(timeStlots)
                                        }

                                        // display Day Name and time
                                        if ((availableFrom !=
                                            '00:00:00' &&
                                            result.data.scheduleDay[0].available_to !=
                                            '00:00:00') &&
                                            (doctorStartTime !=
                                                doctorEndTime)) {
                                            $('.doctor-schedule').
                                                css('display', 'block')
                                            $('.color-information').
                                                css('display', 'block')
                                            $('.available-slot').
                                                css('display', 'block')
                                            $('.day-name').
                                                html(
                                                    result.data.scheduleDay[0].available_on)
                                            $('.schedule-time').
                                                html('[' +
                                                    availableFrom +
                                                    ' - ' +
                                                    result.data.scheduleDay[0].available_to +
                                                    ']')
                                        } else {
                                            $('.doctor-schedule').
                                                css('display', 'none')
                                            $('.color-information').
                                                css('display', 'none')
                                            $('.available-slot').
                                                css('display', 'none')
                                            $('.error-message').
                                                css('display', 'block')
                                            $('.error-message').
                                                html(
                                                    Lang.get('messages.appointment.doctor_schedule_not_available_on_this_date'))
                                        }
                                    } else {
                                        $('.doctor-schedule').
                                            css('display', 'none')
                                        $('.color-information').
                                            css('display', 'none')
                                        $('.available-slot').
                                            css('display', 'none')
                                        $('.error-message').
                                            css('display', 'block')
                                        $('.error-message').
                                            html(
                                                Lang.get('messages.appointment.doctor_schedule_not_available_on_this_date'))
                                    }
                                }
                            }
                        },
                        error: function (error) {
                            displayErrorMessage(error.responseJSON.message)
                        },
                    })

                    if ($('.isCreate').val() || $('.isEdit').val()) {
                        var delayCall = 200
                        setTimeout(getCreateTimeSlot, delayCall)

                        function getCreateTimeSlot () {
                            if ($('.isCreate').val()) {
                                var data = {
                                    editSelectedDate: appointmentSelectedDate,
                                    doctor_id: appointmentDoctorId,
                                }
                            } else {
                                var data = {
                                    editSelectedDate: appointmentSelectedDate,
                                    editId: $('#appointmentEditsID').val(),
                                    doctor_id: appointmentDoctorId,
                                }
                            }

                            $.ajax({
                                url: $('.getBookingSlot').val(),
                                type: 'GET',
                                data: data,
                                success: function (result) {
                                    appointmentAlreadyCreateTimeSlot = result.data.bookingSlotArr
                                    if (result.data.hasOwnProperty(
                                        'onlyTime')) {
                                        if (result.data.bookingSlotArr.length >
                                            0) {
                                            appointmentEditTimeSlot = result.data.onlyTime.toString()
                                            $.each(result.data.bookingSlotArr,
                                                function (index, value) {
                                                    $.each(appointmentIntervals,
                                                        function (i, v) {
                                                            if (value == v) {
                                                                $('.time-interval').
                                                                    each(
                                                                        function () {
                                                                            if ($(
                                                                                this).
                                                                                    data(
                                                                                        'id') ==
                                                                                i) {
                                                                                if ($(
                                                                                    this).
                                                                                        html() !=
                                                                                    appointmentEditTimeSlot) {
                                                                                    $(this).
                                                                                        parent().
                                                                                        css(
                                                                                            {
                                                                                                'background-color': '#ffa721',
                                                                                                'border': '1px solid #ffa721',
                                                                                                'color': '#ffffff',
                                                                                            })
                                                                                    $(this).
                                                                                        parent().
                                                                                        addClass(
                                                                                            'booked')
                                                                                    $(this).
                                                                                        parent().
                                                                                        children().
                                                                                        prop(
                                                                                            'disabled',
                                                                                            true)
                                                                                }
                                                                            }
                                                                        })
                                                            }
                                                        })
                                                })
                                        }
                                        $('.time-interval').each(function () {
                                            if ($(this).html() ==
                                                appointmentEditTimeSlot &&
                                                result.data.bookingSlotArr.length >
                                                0) {
                                                $(this).
                                                    parent().
                                                    addClass('time-slot-book')
                                                $(this).
                                                    parent().
                                                    removeClass('booked')
                                                $(this).
                                                    parent().
                                                    children().
                                                    prop('disabled', false)
                                                $(this).click()
                                            }
                                        })
                                    } else if (appointmentAlreadyCreateTimeSlot.length >
                                        0) {
                                        $.each(appointmentAlreadyCreateTimeSlot,
                                            function (index, value) {
                                                $.each(appointmentIntervals,
                                                    function (i, v) {
                                                        if (value == v) {
                                                            $('.time-interval').
                                                                each(
                                                                    function () {
                                                                        if ($(
                                                                            this).
                                                                                data(
                                                                                    'id') ==
                                                                            i) {
                                                                            $(this).
                                                                                parent().
                                                                                addClass(
                                                                                    'time-slot-book')
                                                                            $('.time-slot-book').
                                                                                css(
                                                                                    {
                                                                                        'background-color': '#ffa721',
                                                                                        'border': '1px solid #ffa721',
                                                                                        'color': '#ffffff',
                                                                                    })
                                                                            $(this).
                                                                                parent().
                                                                                addClass(
                                                                                    'booked')
                                                                            $(this).
                                                                                parent().
                                                                                children().
                                                                                prop(
                                                                                    'disabled',
                                                                                    true)
                                                                        }
                                                                    })
                                                        }
                                                    })
                                            })
                                    }
                                },
                            })
                        }
                    }
                }
            },
        })

        listenChange('#appointmentDepartmentId', function () {
            $('.error-message').css('display', 'none')
            // $('#opdDate').data('DateTimePicker').clear();
            opdDate.clear()
            $('.doctor-schedule').css('display', 'none')
            $('.available-slot-heading').css('display', 'none')
            $('.available-slot').css('display', 'none')
            $.ajax({
                url: $('.doctorDepartmentUrl').val(),
                type: 'get',
                dataType: 'json',
                data: { id: $(this).val() },
                success: function (data) {
                    $('#appointmentDoctorId').empty()
                    $('#appointmentDoctorId').
                        append($('<option value="">'+Lang.get('messages.web_home.select_doctor')+'</option>'))
                    $.each(data.data, function (i, v) {
                        $('#appointmentDoctorId').
                            append($('<option></option>').
                                attr('value', i).
                                text(v))
                    })
                },
            })
        })

        var appointmentDoctorId
        let appointmentDoctorChange = false

        listenChange('#appointmentDoctorId', function () {
            if (appointmentDoctorChange) {
                $('.doctor-schedule').css('display', 'none')
                $('.available-slot-heading').css('display', 'none')
                $('.available-slot').css('display', 'none')
                $('.error-message').css('display', 'none')
                opdDate.clear()
                appointmentDoctorChange = true
            }
            $('.error-message').css('display', 'none')
            appointmentDoctorId = $(this).val()
            appointmentDoctorChange = true
        })

        // if edit record then trigger change
        var appointmentEditTimeSlot
        if ($('.isEdit').val()) {
            $('#appointmentDoctorId').trigger('change', function (event) {
                appointmentDoctorId = $(this).val()
            })

            $('.opdDate').trigger('dp.change', function () {
                var selected = new Date($(this).val())
            })
        }

        //parseIn date_time
        function appointmentParseIn (date_time) {
            var d = new Date()
            d.setHours(date_time.substring(11, 13))
            d.setMinutes(date_time.substring(14, 16))

            return d
        }

        //make time slot list
        function appointmentGetTimeIntervals (time1, time2, duration) {
            var arr = []

            while (time1 < time2) {
                arr.push(time1.toTimeString().substring(0, 5))
                time1.setMinutes(time1.getMinutes() + duration)
            }
            return arr
        }

        var appointmentEditTimeSlot
        listenClick('.time-interval', function () {
            appointmentEditTimeSlot = ($(this).text())
        })

        //Edit appointment
        listenSubmit('#editAppointmentForm', function (event) {
            let editAppointmentOpdDate = $('#appointmentOpdDate').val();
            if (isEmpty(editAppointmentOpdDate)) {
                $('#editAppointmentErrorsBox').show().removeClass('d-none').html(Lang.get('messages.new_change.select_appointment_date')).delay(5000).slideUp(300)
                return false
            }
            if (appointmentEditTimeSlot == null || appointmentEditTimeSlot ==
                '') {
                $('#editAppointmentErrorsBox').show().html(Lang.get('messages.new_change.select_time_slot')).delay(5000).slideUp(300)
                return false
            }
            event.preventDefault()
            screenLock()
            let formData = $(this).serialize() + '&time=' +
                appointmentEditTimeSlot
            $.ajax({
                url: $('#appointmentUpdateUrl').val(),
                type: 'POST',
                dataType: 'json',
                data: formData,
                success: function (result) {
                    displaySuccessMessage(result.message)
                    window.location.href = $('.appointmentIndexPage').val()
                },
                error: function (result) {
                    printErrorMessage('#editAppointmentErrorsBox', result)
                    screenUnLock()
                },
            })
        })

    } else {

        return false

    }

}

//slot click change color
var appointmentSelectedTime
listenClick('.time-interval', function (event) {
    let appointmentId = $(event.currentTarget).attr('data-id')
    if ($(this).data('id') == appointmentId) {
        if ($(this).parent().hasClass('booked')) {
            $('.time-slot-book').css('background-color', '#ffa0a0')
        }
    }
    appointmentSelectedTime = ($(this).text())
    $('.time-slot').removeClass('time-slot-book')
    $(this).parent().addClass('time-slot-book')
})

//create appointment
listenSubmit('#appointmentForm', function (event) {
    let appointmentOpdDate = $('#appointmentOpdDate').val();
    if (isEmpty(appointmentOpdDate)) {
        $('#createAppointmentErrorsBox').show().removeClass('d-none').html(Lang.get('messages.new_change.select_appointment_date')).delay(5000).slideUp(300)
        return false
    }
    if (appointmentSelectedTime == null || appointmentSelectedTime ==
        '') {
        $('#createAppointmentErrorsBox').show().removeClass('d-none').html(Lang.get('messages.new_change.select_time_slot')).delay(5000).slideUp(300)
        return false
    }
    event.preventDefault()
    screenLock()
    let formData = $(this).serialize() + '&time=' +
        appointmentSelectedTime
    $.ajax({
        url: $('#saveAppointmentURLID').val(),
        type: 'POST',
        dataType: 'json',
        data: formData,
        success: function (result) {
            displaySuccessMessage(result.message)
            window.location.href = $('.appointmentIndexPage').val()
        },
        error: function (result) {
            printErrorMessage('#createAppointmentErrorsBox', result)
            screenUnLock()
        },
        complete: function () {
            processingBtn('#appointmentForm',
                '#saveAppointment')
        },
    })
})
