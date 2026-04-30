'use strict';

/*********** MessageBox ****************/

function getModal(id) {
  return bootstrap.Modal.getOrCreateInstance(document.getElementById(id));
}

function infoMessageBox(message, title) {
  document.getElementById('info-body').innerHTML = message;
  document.getElementById('info-title').innerHTML = title;
  getModal('info-popup').show();
}

function errorMessageBox(message) {
  var msg =
    'Operation failed: ' + message + '. ' +
    'Please see error log for details.';
  infoMessageBox(msg, 'Error');
}

function messageBox(body, title, ok_text, close_text, callback) {
  var modalBody = document.getElementById('modal-body');
  if (typeof body === 'string') {
    modalBody.innerHTML = body;
  } else {
    modalBody.innerHTML = '';
    modalBody.appendChild(body);
  }
  document.getElementById('modal-title').innerHTML = title;
  if (ok_text) document.getElementById('modal-button').innerHTML = ok_text;
  if (close_text) document.getElementById('modal-close-button').innerHTML = close_text;

  var btn = document.getElementById('modal-button');
  var newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', function() {
    getModal('popup').hide();
    if (callback) callback();
  });

  getModal('popup').show();
}


/*********** crontab actions ****************/

var schedule = '';
var job_command = '';

function deleteJob(_id) {
  messageBox('<p> Do you want to delete this Job? </p>', 'Confirm delete', null, null, function() {
    $.post(routes.remove, {_id: _id}, function() {
      location.reload();
    });
  });
}

function stopJob(_id) {
  messageBox('<p> Do you want to stop this Job? </p>', 'Confirm stop job', null, null, function() {
    $.post(routes.stop, {_id: _id}, function() {
      location.reload();
    });
  });
}

function startJob(_id) {
  messageBox('<p> Do you want to start this Job? </p>', 'Confirm start job', null, null, function() {
    $.post(routes.start, {_id: _id}, function() {
      location.reload();
    });
  });
}

function runJob(_id) {
  messageBox('<p> Do you want to run this Job? </p>', 'Confirm run job', null, null, function() {
    $.post(routes.run, {_id: _id}, function() {
      location.reload();
    });
  });
}

function refreshCrontab() {
  $.get(routes.import_crontab, function() {
    location.reload();
  }).fail(function(response) {
    errorMessageBox(response.statusText);
  });
}

function testRunJob() {
  var command = collapsedCommand();
  var envVars = $('#job-env-vars').val();
  if (!command || !command.trim()) {
    errorMessageBox('Enter a command before running');
    return;
  }
  var btn = document.getElementById('job-test-run');
  var wrap = document.getElementById('job-test-result-wrap');
  var pre = document.getElementById('job-test-result');
  var status = document.getElementById('job-test-status');
  btn.setAttribute('disabled', 'disabled');
  btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Running...';
  wrap.style.display = 'block';
  status.textContent = '';
  pre.textContent = '(running)';
  $.post(routes.test_run, { command: command, envVars: envVars || '' }, function(result) {
    var parts = [];
    if (result.stdout) parts.push('--- stdout ---\n' + result.stdout);
    if (result.stderr) parts.push('--- stderr ---\n' + result.stderr);
    if (!parts.length) parts.push('(no output)');
    pre.textContent = parts.join('\n\n');
    var label = result.timedOut ? 'timed out' : ('exit code ' + result.exitCode);
    status.textContent = '(' + label + ')';
  }).fail(function(xhr) {
    pre.textContent = (xhr.responseJSON && xhr.responseJSON.message) || xhr.statusText || 'request failed';
    status.textContent = '(error)';
  }).always(function() {
    btn.removeAttribute('disabled');
    btn.innerHTML = '<i class="bi bi-play-circle"></i> Test Run';
  });
}

function handleSaveFailure(xhr) {
  if (xhr.status === 409) {
    infoMessageBox(
      'This job was modified elsewhere. Reloading to show the latest version.',
      'Conflict'
    );
    setTimeout(function() { location.reload(); }, 1500);
    return;
  }
  errorMessageBox(xhr.statusText || 'request failed');
}

function editJob(_id) {
  var job = null;
  crontabs.forEach(function(crontab) {
    if (crontab._id == _id) job = crontab;
  });

  resetTestResult();
  if (job) {
    getModal('job').show();
    $('#job-name').val(job.name);
    $('#job-command').val(job.command);
    $('#job-env-vars').val(job.envVars || '');
    $('#job-version').val(job.version != null ? job.version : '');
    if (job.schedule.indexOf('@') !== 0) {
      var components = job.schedule.split(' ');
      $('#job-minute').val(components[0]);
      $('#job-hour').val(components[1]);
      $('#job-day').val(components[2]);
      $('#job-month').val(components[3]);
      $('#job-week').val(components[4]);
    }
    if (job.mailing) {
      $('#job-mailing').attr('data-json', JSON.stringify(job.mailing));
    }
    schedule = job.schedule;
    job_command = job.command;
    if (job.logging && job.logging != 'false')
      $('#job-logging').prop('checked', true);
    job_string();
  }

  var saveBtn = document.getElementById('job-save');
  var newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  newSaveBtn.addEventListener('click', function() {
    if (!schedule) schedule = '* * * * *';
    var name = $('#job-name').val();
    var mailing = JSON.parse($('#job-mailing').attr('data-json'));
    var logging = $('#job-logging').prop('checked');
    var version = $('#job-version').val();
    var envVars = $('#job-env-vars').val();
    $.post(routes.save, {name: name, command: collapsedCommand(), schedule: schedule, _id: _id, logging: logging, mailing: mailing, version: version, envVars: envVars}, function() {
      location.reload();
    }).fail(handleSaveFailure);
    getModal('job').hide();
  });
}

function newJob() {
  schedule = '';
  job_command = '';
  $('#job-minute').val('*');
  $('#job-hour').val('*');
  $('#job-day').val('*');
  $('#job-month').val('*');
  $('#job-week').val('*');

  resetTestResult();
  getModal('job').show();
  $('#job-name').val('');
  $('#job-command').val('');
  $('#job-env-vars').val('');
  $('#job-version').val('');
  $('#job-mailing').attr('data-json', '{}');
  $('#job-logging').prop('checked', false);
  job_string();

  var saveBtn = document.getElementById('job-save');
  var newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
  newSaveBtn.addEventListener('click', function() {
    if (!schedule) schedule = '* * * * *';
    var name = $('#job-name').val();
    var mailing = JSON.parse($('#job-mailing').attr('data-json'));
    var logging = $('#job-logging').prop('checked');
    var envVars = $('#job-env-vars').val();
    $.post(routes.save, {name: name, command: collapsedCommand(), schedule: schedule, _id: -1, logging: logging, mailing: mailing, envVars: envVars}, function() {
      location.reload();
    }).fail(handleSaveFailure);
    getModal('job').hide();
  });
}

function duplicateJob(_id) {
  var job = null;
  crontabs.forEach(function(crontab) {
    if (crontab._id == _id) job = crontab;
  });
  if (!job) return;

  var name = job.name ? job.name + ' (copy)' : '';
  var logging = (job.logging && job.logging != 'false') ? job.logging : 'false';
  var mailing = job.mailing || {};

  $.post(routes.save, {
    name: name,
    command: job.command,
    schedule: job.schedule,
    _id: -1,
    logging: logging,
    mailing: mailing,
    envVars: job.envVars || ''
  }, function() {
    location.reload();
  });
}

function resetTestResult() {
  var wrap = document.getElementById('job-test-result-wrap');
  if (wrap) wrap.style.display = 'none';
  var pre = document.getElementById('job-test-result');
  if (pre) pre.textContent = '';
  var status = document.getElementById('job-test-status');
  if (status) status.textContent = '';
}

function doBackup() {
  messageBox('<p> Do you want to take backup? </p>', 'Confirm backup', null, null, function() {
    $.get(routes.backup, {}, function() {
      location.reload();
    });
  });
}

function delete_backup(db_name) {
  messageBox('<p> Do you want to delete this backup? </p>', 'Confirm delete', null, null, function() {
    $.get(routes.delete_backup, {db: db_name}, function() {
      location = routes.root;
    });
  });
}

function restore_backup(db_name) {
  messageBox('<p> Do you want to restore this backup? </p>', 'Confirm restore', null, null, function() {
    $.get(routes.restore_backup, {db: db_name}, function() {
      location = routes.root;
    });
  });
}

function import_db() {
  messageBox(
    '<p> Do you want to import crontab?<br /> A backup will be created automatically before importing.</p>',
    'Confirm import from crontab', null, null, function() {
      $('#import_file').click();
    });
}

function setMailConfig(a) {
  var data = JSON.parse(a.getAttribute('data-json'));
  var container = document.createElement('div');

  var message = "<p>This is based on nodemailer. Refer <a href='http://lifepluslinux.blogspot.com/2017/03/introducing-mailing-in-crontab-ui.html'>this</a> for more details.</p>";
  container.innerHTML += message;

  var transporterLabel = document.createElement('label');
  transporterLabel.className = 'form-label';
  transporterLabel.innerHTML = 'Transporter';
  var transporterInput = document.createElement('input');
  transporterInput.type = 'text';
  transporterInput.id = 'transporterInput';
  transporterInput.setAttribute('placeholder', config.transporterStr);
  transporterInput.className = 'form-control';
  if (data.transporterStr) {
    transporterInput.setAttribute('value', data.transporterStr);
  }
  container.appendChild(transporterLabel);
  container.appendChild(transporterInput);

  container.innerHTML += '<br/>';

  var mailOptionsLabel = document.createElement('label');
  mailOptionsLabel.className = 'form-label';
  mailOptionsLabel.innerHTML = 'Mail Config';
  var mailOptionsInput = document.createElement('textarea');
  mailOptionsInput.setAttribute('placeholder', JSON.stringify(config.mailOptions, null, 2));
  mailOptionsInput.className = 'form-control';
  mailOptionsInput.id = 'mailOptionsInput';
  mailOptionsInput.setAttribute('rows', '10');
  if (data.mailOptions)
    mailOptionsInput.innerHTML = JSON.stringify(data.mailOptions, null, 2);
  container.appendChild(mailOptionsLabel);
  container.appendChild(mailOptionsInput);

  container.innerHTML += '<br/>';

  var button = document.createElement('a');
  button.className = 'btn btn-primary btn-sm';
  button.innerHTML = 'Use Defaults';
  button.onclick = function() {
    document.getElementById('transporterInput').value = config.transporterStr;
    document.getElementById('mailOptionsInput').innerHTML = JSON.stringify(config.mailOptions, null, 2);
  };
  container.appendChild(button);

  var buttonClear = document.createElement('a');
  buttonClear.className = 'btn btn-secondary btn-sm';
  buttonClear.innerHTML = 'Clear';
  buttonClear.onclick = function() {
    document.getElementById('transporterInput').value = '';
    document.getElementById('mailOptionsInput').innerHTML = '';
  };
  container.appendChild(buttonClear);

  messageBox(container, 'Mailing', null, null, function() {
    var transporterStr = document.getElementById('transporterInput').value;
    var mailOptions;
    try {
      mailOptions = JSON.parse(document.getElementById('mailOptionsInput').value);
    } catch (err) { /* ignore parse error */ }

    if (transporterStr && mailOptions) {
      a.setAttribute('data-json', JSON.stringify({transporterStr: transporterStr, mailOptions: mailOptions}));
    } else {
      a.setAttribute('data-json', JSON.stringify({}));
    }
  });
}

function setHookConfig(a) {
  messageBox('<p>Coming Soon</p>', 'Hooks', null, null, null);
}

function collapsedCommand() {
  return job_command.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(Boolean).join('; ');
}

function job_string() {
  var cmd = collapsedCommand();
  $('#job-string').val(schedule + ' ' + cmd);
  return schedule + ' ' + cmd;
}

function set_schedule() {
  schedule = $('#job-minute').val() + ' ' + $('#job-hour').val() + ' ' + $('#job-day').val() + ' ' + $('#job-month').val() + ' ' + $('#job-week').val();
  job_string();
}

function quick_schedule(s) {
  schedule = s;
  var fields = {
    '* * * * *': ['*', '*', '*', '*', '*'],
    '@hourly':   ['0', '*', '*', '*', '*'],
    '@daily':    ['0', '0', '*', '*', '*'],
    '@weekly':   ['0', '0', '*', '*', '0'],
    '@monthly':  ['0', '0', '1', '*', '*'],
    '@yearly':   ['0', '0', '1', '1', '*'],
    '@reboot':   ['', '', '', '', '']
  }[s] || ['*', '*', '*', '*', '*'];
  $('#job-minute').val(fields[0]);
  $('#job-hour').val(fields[1]);
  $('#job-day').val(fields[2]);
  $('#job-month').val(fields[3]);
  $('#job-week').val(fields[4]);
  job_string();
}

function previewCrontab() {
  $.get(routes.preview_crontab, function(data) {
    document.getElementById('preview-crontab-content').textContent = data || '# (empty crontab)';
    getModal('preview-crontab-modal').show();
  });
}

function copyCrontab() {
  var text = document.getElementById('preview-crontab-content').textContent;
  navigator.clipboard.writeText(text).then(function() {
    var btn = document.querySelector('#preview-crontab-modal .btn-outline-secondary');
    btn.innerHTML = '<i class="bi bi-check2"></i> Copied!';
    setTimeout(function() {
      btn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
    }, 2000);
  });
}
