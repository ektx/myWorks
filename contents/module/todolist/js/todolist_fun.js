/*
	功能函数
	--------------------------------
	@author: zwl
*/


// 重命名类型
function renameType () {
	$('.ready', '#todo-type-list').find('input').removeAttr('readonly').focus().end().click();
	$('.hd-day-inner .inner').hide()
}


/*
	日历显示当前日期
*/
function goToToday (id) {
	let nowTime = new Date();
	makeCalendar(nowTime.getFullYear(), nowTime.getMonth()+1, nowTime.getDate(), id);
}


/* 
	生成日历
	@year [number] 年
	@month [number] 月
	@data [number] 天
	@id 查询的类型
*/
function makeCalendar(year, month, date, id) {

	let generateTable = function(days) {

		let dataArr = calendar.str(year, month),
			calendarHTML = '';

		for (let i = 0; i < 42; i++ ) {
			let _d = dataArr[i] || '',
				calendarDayId = '',
				_class = '';

			if (_d) calendarDayId = ' id="calDay-'+_d+'"';

			// 标记当天
			if (_d == date) {
				_class += 'day current ';
			}

			// 标记事件
			if (days.indexOf(_d) > -1) {
				_class += 'events';
			}

			if (_class.length) {
				_class = ' class="'+_class+'"';
			}

			calendarHTML += '<li' + calendarDayId + _class + '><span>'+ _d + '</span></li>';
		}

		$('.calendar-days').html(calendarHTML)
		.data({
			'year': year,
			'month': month,
			'day': date
		})
		.parent().prev().find('span').text(year+'年'+month+'月')
	}

	let nowTypeID = id || $('.current','#todo-type-list').data().id;

	// 摘取此分类事件有日期的标识
	webSQLCommon(
		`SELECT time FROM calendarDays WHERE time LIKE '${year}-${month > 10 ? month : '0'+month}%' AND dayType IN (${nowTypeID})`, [], data => {
		let dayArr = [];

		for (let i = 0, l = data.rows.length; i < l; i++) {
			dayArr.push( parseInt(data.rows[i].time.substr(8)) )
		}
		generateTable( dayArr )

	}, err => {
		console.log(err)
	})
}

// 生成事件分类列表
// @key 指定选中效果
function generateTodoType (key) {

	let currentID = '';

	let done = function(data) {

		let ulInner = '';

		data = data.rows;

		for (let i = 0,l = data.length; i < l; i++) {
			let _cur = '';
			if (data[i].id == key) {
				_cur = ' class="current"';
				
				currentID = data[i].id;
			}
			ulInner += `<li ${_cur} data-id="${data[i].id}"><input value="${data[i].name}" readonly /></li>`
		}

		$('#todo-type-list').html( ulInner )
		.find(`[data-id="${key}"]`).click();
	}

	let fail = (err) => {
		console.error(err)
	}

	webSQLCommon(
		'SELECT * FROM todoType',
		[],
		done,
		fail
	)


}


/*
	事件列表标题与日期
	-----------------------------
*/
function updateTitleTime (title, year, month, week) {
	let _html = '';

	if (arguments.length === 4 || year == 1) {
		let _d = new Date();
		let _year = year == 1;

		title = _year ? _d.getDate() : title;
		year  = _year ?  _d.getFullYear() : year;
		month = month || (_d.getMonth()+1);
		week  = week || calendar.week();

		$('.inner', '.hd-day-inner').show()

		_html = `<input class="title day" type="text" placeholder="搜索" value="${title}" readonly/>`;
		_html += `<div class="inner"><p>${week}</p><p>${year}年${month}月</p></div>`;
	} else {
		_html = `<input class="title" type="text" placeholder="搜索" value="${title}" readonly/>`;
		$('.inner', '.hd-day-inner').hide()
	}

	$('.hd-day-inner').html( _html )

}


/*
	生成当前分类事件清单
	-------------------------------
	@todoType [object] 当前分类
		id
		name
*/
function genToDoList (data, todoType) {

	webSQLCommon(
		`SELECT * FROM todoType`,
		[],
		result => {

			let liHTML = '';
			let typeObj = {};

			for (let i = 0, l = result.rows.length; i < l; i++) {
				typeObj[result.rows[i].id] = result.rows[i].name;
			}

			for (let i = 0, l = data.length; i < l; i++) {
				let _data = data[i];
				let _checked = _data.complete ? 'checked':'';

				liHTML += todoListLiTem(_data, _checked, typeObj, todoType);
			}

			$('ul','.todo-list-box').html( liHTML )
			
		},
		err => {
			console.error(err)
		}
	)
}


/*
	生成待办事件列表模板
	-------------------------------
*/
function todoListLiTem (data, checked, todoType, nowType) {
	let _title = data.title || '',
		_des = data.description || '';
	let	_id = data.id || 'new';

	nowType = nowType || {};

	let descriptionMod = '';

	// 存在分类的 我们也得到分类集合 现在点击的分类不是当前此条的归类时
	if (data.parent && typeof todoType === 'object' && nowType.id != data.parent) {
		descriptionMod = `<p class="title-help-info">
							<span>${todoType[data.parent]}</span>
						</p>`;
	}

	return  `<li data-id="${_id}" 
				 data-parent="${data.parent}" 
				 data-time="${data.remindTime}"
			>
				<div class="header">
					<label>
						<input class="is-done" type="checkbox" ${checked}>
					</label>
					<div class="title-box">
						<input class="title" value="${_title}" />
						${descriptionMod}
					</div>
					<span class="li-btns-box">
						<button class="tbtn arrow-ico down-arrow"></button>
					</span>
				</div>
				<ul class="inner">
					<dl>
						<dt>备注:</dt>
						<dd>
							<textarea class="inner-box">${_des}</textarea>
						</dd>
					</dl>
				</ul>
			</li>`;
}


/*
	保存数据
	-------------------------------
*/
function saveMyToDoList (_this) {

	let typeId = document.getElementById('todo-type-list').getElementsByClassName('current').item(0);
	let _title = _this.find('.title');
	let title  = _title.val();
	let isDone = 0;
	let remark = _this.find('.inner-box').val();
	let parent = _this.data().parent || '',
		id     = + new Date(),
		calTime = calendarTitleTime(),
		reTime  = '';

	typeId = typeId ? typeId.dataset.id : 0;

	if ( parseInt(parent) < 100) {
		parent = '';
	}

	reTime = calendar.format('YYYY-MM-DD',`${calTime.year}-${calTime.month}-${calTime.day}`);

	// 没有写标题的不算~
	if (!title) {
		_this.remove()
		return;
	}

	let done = function() {
		_this.attr({
			'data-id': id,
			'data-time': reTime
		});

		_this.data().id = id;
		_this.data().time = reTime;
		_this.data().parent = parent;

		// 在有时间提醒时 处理日历上事件效果
		if (reTime) {
			let _type = 'update';
			if (!calTime.hasEvent) {
				_type = 'add';
			}
			setCalendarDayEvent({
				type: _type, 
				time: reTime,
				parent: parent,
				updateType: '+'
			})
		}
	}

	webSQLInsert(
		'todoEvent', 
		'id, title, complete, description, parent, remindTime', 
		[id, title, isDone, remark, parent, reTime],
		done,
		err => {
			console.log(err)
		}
	)
}


/*
	获取小日历上的时间
*/
function calendarTitleTime () {
	let calendarDays = $('.calendar-days');
	let YYMM = calendarDays.data();
	let year = YYMM.year;
	let month= YYMM.month;
	let day  = YYMM.day;

	let currentDay = calendarDays.find('.current');
	let week = calendar.week(`${year}-${month}-${day}`);
	let events = currentDay.length > 0 ? currentDay[0].matches('.events') : false;

	let time = new Date();
	let hour = time.getHours();
	let min  = time.getMinutes();
	let sed  = time.getSeconds();

	return {
		ele: currentDay,
		year: year,
		month: month,
		day: day,
		week: week,
		hour: hour,
		min: min,
		sed: sed,
		time: time,
		timeStr: `${year}-${month < 10 ? '0'+month: month}-${day<10?'0'+day:day}`,
		hasEvent: events
	}
}


/*
	更新或添加日历索引
	@type  add | update | del
	@time  日历事件时间
*/
function setCalendarDayEvent(obj) {

	let type = obj.type;
	let time = obj.time;
	let parent = obj.parent;

	let done = data => {
		console.log(data)
	};

	let fail = err => {
		console.error(err)
	}

	let addRemind = () => {
		document.querySelector('#calDay-'+parseInt(time.substr(8)), '.calendar-days').classList.toggle('events');

	}

	switch (type) {
		case 'update':

			webSQLCommon(
				`UPDATE calendarDays SET sum = sum${obj.updateType}1 WHERE time = ?`,
				[time], 
				data => {
					webSQLCommon(
						`UPDATE todoEvent SET complete=? WHERE id = ?`, 
						[this.checked ? 1:0, id],
						done,
						fail
					)
				}, 
				fail
			)
			break;

		case 'add':
			webSQLInsert('calendarDays', 'time, sum, dayType', [time, 1, parent], addRemind, fail);
			break;

		case 'del':
			webSQLCommon(
				`DELETE FROM calendarDays WHERE time=?`,
				[time],
				addRemind,
				fail
			)
	}
}


/*
	导出功能
	-------------------------------
	@type
*/
function exportData(type) {

	let fileInner = '';
	let nowType = $('#todo-type-list .current');

	let writeFile = (data, fileName)=> {
		let WF = fs.createWriteStream( app.getPath('desktop') + `/${fileName}`, {defaultEncoding: 'utf8'});
		WF.write( data )
	}

	if ( nowType.length > 0 ){

		if (nowType.data().id < 100) {
			alert('今天和所有无法为您导出!');
			return;
		}
	} else {
		alert('请先选择你要导出的类别!然后尝试导出!');
		return;
	}

	switch (type) {
		// 导出所有数据
		case 1:
			fileInner = '导出数据';
			break;

		// 导出周报形式
		case 2:
			fileInner = '周报';
			break;
	}


	webSQLCommon(
		`SELECT * FROM todoEvent`, [],
		data => {

			writeFile( JSON.stringify(data.rows, '', '\t'), 'event.txt' );

		},
		error => {
			console.error(error)
		}
	);

}


// 删除指定的类
function delListDom (ele, table) {

	let li = $('.ready', ele);

	let done = function() {

		getTableList('todoEvent', function(data){
			console.log(data);

			if (!data.length) {
				console.warn('remove');

				let removeTime = calendar.reTimeStamp(reTime);
				let findTime   = parseInt(removeTime.getFullYear()+''+(removeTime.getMonth()+1));

				let keyDone = function (data) {
					console.log();

					let _day  = removeTime.getDate();
					let index = data.days.indexOf(_day);
					data.days.splice(index, 1);

					updataDB('calendarDayEvent', findTime, 'days', data.days, function() {
						$('#calDay-'+_day).removeClass('events')
					})


				}
				let keyFail = function(err) {
					console.error(err)
				}

				getKeyInfo('calendarDayEvent', findTime, keyDone, keyFail)
			}
		}, {
			filter: 'only',
			key: 'remindTime',
			value: reTime
		})
		_.remove();
	}

	let fail = function() {
		console.error('del fail!')
	}

	if (ele === '.todo-list-box') {
		console.log('del event')

		// 
		let liData = li.data();

		// 对于有时间的事件
		if (liData.time) {
			webSQLCommon(
				`SELECT remindTime, parent FROM todoEvent WHERE date(remindTime)=date(?)`,
				[liData.time],
				data => {
					// 如果当前时间已经没有其它事件了,我们删除日历上的提醒
					if (data.rows.length == 1) {
						setCalendarDayEvent({
							type: 'del', 
							time: liData.time,
							parent: data.rows[0].parent
						})
					} else {
						setCalendarDayEvent({
							type: 'update', 
							time: liData.time, 
							parent: data.rows[0].parent,
							updateType: '-'
						})
					}
				},
				err => {
					console.error(err)
				}
			)
		}

		// 删除当前数据
		webSQLCommon(
			`DELETE FROM todoEvent WHERE id=?`,
			[liData.id],
			data => {
				console.log(data);
				// 删除行
				li.remove();
			},
			err => {
				console.error(err)
			}
		)

	} else {
		console.log('del type')
	}

}

