const fs = nodeRequire('fs');

$(function() {

	/*
		创建一个 20M 的 websql 数据库
	*/
	webSQLOpenDB('myWork', '1.0', 'myWork database!', 20, isdone => {
		if (isdone) {
			console.log('DB connect success!')
		} else {
			console.log('DB not connect!')
		}
	});

	/*
		创建表格 列表
	*/
	function init () {
		console.log('初始化...');

		let initApp = () => {

			let done = result => {
				console.log(result)
			};
			let fail = err => {
				console.log(err.message)
			}

			webSQLCreateTable('todoType', 'id unique, name', done, fail);
			webSQLCreateTable('calendarDays', 'time, sum, dayType', done, fail);
			webSQLCreateTable('todoEvent', 'id unique, title, complete, description, parent, remindTime', done, fail)
			webSQLCreateTable('appInfo','dbversion, currentType', done, fail);

			webSQLInsert('appInfo', 'dbversion, currentType', [1, 1])
			webSQLInsert('todoType', 'id, name', [1, '今天'])
			webSQLInsert('todoType', 'id, name', [2, '计划'])

			webSQLInsert('calendarDays', 'time, sum', ['2017-02-01', 1])

			webSQLInsert('todoEvent', 'id, title, complete, description, remindTime', [1, 'Welcome Use MyWork', 0, 'This is a electron APP!', '2017-02-01 12:00:00'])

		}


		// 初始化界面
		let init_display = ()=> {

			webSQLCommon(
				`SELECT currentType FROM appInfo`,
				[],
				done => {
					let _id = done.rows[0] ? done.rows[0].currentType : 1;
					// 展现主菜单
					generateTodoType ( _id );
				},
				fail => {
					console.error(fail)
				}
			)

			goToToday();
			
		}

		// 判断数据库是否有数据在了,没有数据时则初始化应用程序
		webSQLCommon(
			'SELECT name FROM sqlite_master WHERE type="table" AND name="appInfo"', [],
			result => {

				if (result.rows.length) {
					console.log('初始化完成!')
				}  else {
					// 初始化数据库
					initApp()
				}

				init_display();
			},
			err => {
				console.warn('初始化数据库错误!')
			} 
		)

	};

	init()

	// 主菜单时时日期
	let setDate = function() {
		let d = new Date().getDate();
		// dock 
		let ele = $('.data-day-ico', '.main-nav');

		if (ele.text() == d) return;
		else {
			ele.text( d );
			// 更新小日历日期
			$('#calDay-'+d).addClass('day').click().siblings().removeClass('day');
		};
		
	}
	setDate();
	setInterval(setDate, 1000);


	/*
		右键菜单功能
	*/
	const {remote} = nodeRequire('electron');
	const {Menu, MenuItem} = remote;

	function createMenu (menuArr) {
		const menu = new Menu();

		for (let i = 0, l = menuArr.length; i < l; i++) {
			menu.append(new MenuItem( menuArr[i] ))
		}
		menu.popup(remote.getCurrentWindow())
	}


	// 右键菜单功能
	window.addEventListener('contextmenu', function(e) {
		e.preventDefault();
		
		// 对类型菜单进行操作
	  	if ( e.target.matches('input') && e.target.parentNode.parentNode.matches('#todo-type-list') ) {
	  		let menuArr = [
	  			{
	  				label: '重命名',
	  				click(menuItem, browserWindow, e) {
	  					// console.log(menuItem, browserWindow, e, event);
	  					renameType()
	  				}
	  			},
	  			{
	  				type: 'separator'
	  			},
	  			{
	  				label: '删除',
	  				click() {
	  					delListDom('#todo-type-list', 'todoType');
	  				}
	  			}
	  		];

	  		// 系统生成的菜单不可修改或删除
	  		if (!(e.target.parentNode.dataset.id < 100)) {

				$(e.target).parent('li').addClass('ready')
				.siblings().removeClass('ready');

		  		createMenu( menuArr );
	  		}


	  	} else if ( $(e.target).parents().is('.todo-list-box') ) {
	  		let menuArr = [
	  			{
	  				label: '删除',
	  				click() {
	  					delListDom('.todo-list-box', 'todoEvent')
	  				}
	  			}
	  		]

	  		$(e.target).closest('li').addClass('ready').siblings().removeClass('ready');

	  		createMenu( menuArr )
	  	}
	}, false);


	// 点击日历时间,定位到这今天
	$('.calendar-control span').click(goToToday);


	// 上下月切换日历
	$('button', '.calendar-control').click(function() {
	
		let _ = $(this).siblings('span').text().match(/\d+/g);
		let y = _[0];
		let m = _[1];

		if (this.id == 'prev') {
			m--;

			if (!m) {
				m = 12;
				y--;
			}

		} else if(this.id == 'next') {
			m++;

			if (m > 12) {
				m = 1;
				y++
			}

		}

		makeCalendar(y, m, new Date().getDate());
	})

	/*
		日历选择功能
		---------------------------
	*/
	$('.calendar-days').on('click', 'li', function(){
		let _c = 'current';
		let _  = $(this);
		let date = _.text();
		let $type  = $('.current','.my-works-desktop');
		let typeId = $type.length ? $type.data().id : null;

		if (date) {

			$(this).addClass(_c).siblings().removeClass(_c);
			
			// 移除列表选择
			if (typeId < 2)
				$type.removeClass();
	
			let YYMM = calendarTitleTime();
			let queryTime = calendar.format('YYYY-MM-DD', `${YYMM.year}-${YYMM.month}-${date}`);
			let query = `SELECT * FROM todoEvent WHERE date(remindTime)=date('${queryTime}')`;

			webSQLCommon(query, [], data => {
				updateTitleTime(date, YYMM.year, YYMM.month, YYMM.week)

				// 更新列表
				genToDoList(data.rows)

			}, err => {
				console.error(err)
			})
		}

	});


	/*
		计划列表功能
	*/
	$('#todo-type-list').on('click', 'li', function() {

		// 移除日历上的选择
		// $('li','.calendar-days').removeClass('current');

		// 对添加功能
		let addBtn = document.getElementById('add-todo-event');

		if (addBtn.matches('.clear-search')) addBtn.classList.remove('clear-search');

		let _ = $(this),
			txt = _.find('input').val();
			titleBox = $('.os-day-header'),
			id = this.dataset.id,
			query = `SELECT * FROM todoEvent WHERE parent in (${id})`;

		if (id == 2) {
			query = 'SELECT * FROM todoEvent'
		} else if (id == 1) {
			// http://blog.csdn.net/rightfa/article/details/50558120
			// seLECT * frOM todoEvent whERE remindTime between '2017-01-01' and '2017-02-02'
			// seLECT * frOM todoEvent whERE date(remindTime)=date('2017-02-01')
			query = `SELECT * FROM todoEvent WHERE date(remindTime)=date('${calendar.format('YYYY-MM-DD')}')`
		}

		webSQLCommon(query,[], (data)=>{
			updateTitleTime(txt, id)

			// 更新列表
			genToDoList(data.rows, {id: id, name:txt})
		}, err=>{
			console.log(err)
		})
		// 添加状态
		$(this).addClass('current').siblings().removeClass();

		// 更新 appInfo currentType
		webSQLCommon(
			`UPDATE appInfo SET currentType=?`,
			[id]
		)

	}).on('mouseover', 'li', function() {
		$(this).addClass('ready').siblings().removeClass('ready')
	})


	// 添加新的类型
	$('#addToDoType').click(function() {
		let _box = $('#todo-type-list');
		let _current = _box.find('.create');
		
		// 添加
		let appendLi = function() {
			let titleBox = $('.os-day-header');

			$('<li class="current"><input class="create" type="text"></li>').appendTo(_box);

			// 添加状态
			_box.find('li:last-child').find('input').focus().end()
			.siblings().removeClass();

			// 隐藏日期
			titleBox.find('.inner').children().hide();
		}

		// 如果没有正在新建,则添加一个
		if (!_current.length) {
			appendLi()
		} 
		// 正在创建时,
		else {
			let __val = _current.val().trim();
			if (__val) {
				// 保存当前
				_saveType(_current, __val)
				// 添加新的
				appendLi()
			} else {
				_current.focus()
			}
		}

	});

	// 搜索功能
	let SEARCH_DELAY;
	$('.hd-day-inner').on('dblclick', function(e) {
		let _titleEle = $(this).find('.title');
		let typeCur = $('.current','#todo-type-list');

		if (_titleEle.hasClass('day')) {
			_titleEle.removeClass('day').addClass('r-day').next().hide();
		}
		_titleEle.addClass('search').val('').removeAttr('readonly').focus();

		// 设置搜索提醒
		_titleEle.attr('placeholder', `搜索: ${typeCur.find('input')[0].value}`);

		// 让添加事件变成清空功能
		$('#add-todo-event').addClass('clear-search').attr('data-currenttype', typeCur.data().id );

	}).on('blur', '.title', function() {
		// $(this).attr('readonly', 'readonly')
	})
	// 文字输入查询功能
	.on('input', '.title', function() {
		clearTimeout( SEARCH_DELAY );
		SEARCH_DELAY = setTimeout(()=>{
			console.log(this.value);
			let typeCur = $('.current','#todo-type-list');
			let query = '';

			if ( typeCur ) {

				switch (typeCur.data().id) {
					case 1:
						query = `SELECT * FROM todoEvent WHERE title like '%${this.value}%' AND date(remindTime)=data('${calendar.format('YYYY-MM-DD')}')`;
						break;

					case 2:
						query = `SELECT * FROM todoEvent WHERE title like '%${this.value}%'`;
						break;

					default:
						query = `SELECT * FROM todoEvent WHERE title like '%${this.value}%' AND parent = ${typeCur.data().id}`;

				}
			}

			if (!this.value.trim().length) {
				$('ul','.todo-list-box').html( '' );
				return;
			} 

			webSQLCommon(
				query,
				[],
				result => {
					// 更新列表
					genToDoList(result.rows)
				},
				err => {
					console.log(err)
				}
			)

		}, 500)
	})

	// 事件分类事件
	$('#todo-type-list').on('blur', 'input', function(e) {
		
		let titleBox = $('.os-day-header'),
			oldTitle = this.defaultValue || '';

		// 保存类型
		let _saveType = function(_this) {
			let id = +new Date();
			let done = data => {
				_this.setAttribute('readonly', 'readonly');
				_this.parentNode.setAttribute('data-id', id);
			}

			let fail = err => {
				console.error(err)
			}

			webSQLInsert('todoType', 'id, name', [id, _this.value], done, fail)
		}

		// 防止自动加成
		if (this.hasAttribute('readonly')) return;

		if (!this.value) {
			if (!oldTitle) {
				$(this).parent().remove()
			} else {
				this.value = oldTitle;
				this.setAttribute('readonly', 'readonly');
			}
		} else {
			if (oldTitle) {

				let done = function(_) {
					_.setAttribute('readonly', 'readonly');
				}

				let fail = function(err) {
					console.error(err)
				}

				webSQLCommon(
					`UPDATE todoType SET name='${this.value}' WHERE id=${parseInt(this.parentNode.dataset.id)}`,
					[],
					done(this),
					fail
				)

			} else {
				_saveType(this);
				this.defaultValue = this.value;
			}
		}

	}).on('input', 'input', function() {
		let titleBox = $('.os-day-header'),
			oldTitle = '';

		titleBox.find('.title').val(this.value)
	})


	/*
		事件处理
		-----------------------------------------
	*/
	$('.todo-list-box')
	// 切换显示待办事项具体信息
	.on('click', '.tbtn', function() {

		let _ = $(this);
		let className = 'show';
		let header = _.parent().parent('.header');
		let info = header.siblings();

		if (info.height()) {
			info.addClass('animate').height(0).parent().removeClass(className)
		} else {
			let _T = info.find('textarea');
			
			_T.height(_T[0].scrollHeight);

			let _H = info[0].scrollHeight;

			info.addClass('animate').height( _H )
			.parent().addClass(className)
		}

		// 优化在多信息展开详细时,收缩后当前提醒无法固定头部功能
		setTimeout(function() {
			_.parents('.todo-list-box').scroll()
		}, 310)
	})
	// 事件完成情况
	.on('change', '.is-done', function() {
		let id = parseInt($(this).parents('li').attr('data-id'));

		webSQLCommon(
			`UPDATE todoEvent SET complete=? WHERE id = ?`,
			[this.checked ? 1:0, id],
			result => {},
			err => {
				console.error(err)
			}
		)

	})
	// 备注信息高度控制
	.on('input', '.inner-box', function(e) {
		let _ = $(this),
			_inner = _.parents('.inner');

		_.height(32).parent().height(32);

		let _H = e.target.scrollHeight;
			
		_.height( _H );
		_inner.removeClass('animate').height(_.parent().parent().prev().height() + _H + 29);


	})
	// 更新事件内容
	.on('focusout', 'li', function(e) {
		let key = value = '',
			_  = $(this),
			id = _.attr('data-id');

		if (id === 'new') {
			// 保存
			saveMyToDoList(_);
			return;
		}

		id = parseInt(id);

		switch ( e.target.className ) {
			case 'title':
				key = 'title';
				value = e.target.value;
				break;

			case 'inner-box':
				key = 'description';
				value = e.target.value;
				break;

		}

		if (!key) return;

		webSQLCommon(
			`UPDATE todoEvent SET ${key}=? WHERE id=?`,
			[value, id],
			result => { },
			err => { 
				console.log(err)
			}
		)

	})

	.on('mouseover', 'li', function() {
		$(this).addClass('ready').siblings().removeClass('ready')
	})

	// 添加新的事件
	$('#add-todo-event').click(function() {
		let typeLi = $('.current', '#todo-type-list');
		let parent = '';
		let isNew = $('[data-id="new"]');

		// 清除功能时
		if ( this.matches('.clear-search') ) {
			let searchVal = document.querySelector('.title', '.hd-day-inner');
			if ( searchVal.value ) {
				searchVal.value = '';
			} else {
				document.querySelector(`[data-id="${this.dataset.currenttype}"]`).click();
				this.classList.remove('clear-search')
			}
		} 
		// 添加功能时
		else {

			if ( isNew.length ) {
				isNew.find('.title').focus()
				return;	
			}

			if (typeLi.length) {
				parent = typeLi.data().id;
			}

			let html = todoListLiTem({parent: parent})

			$('.todo-list-box > ul').append(html).find('.title:last').focus();
			
		}
	});

});


// 重命名类型
function renameType () {
	$('.ready', '#todo-type-list').find('input').removeAttr('readonly').focus().end().click();
	$('.hd-day-inner .inner').hide()
}


/*
	日历显示当前日期
*/
function goToToday () {
	let nowTime = new Date();
	makeCalendar(nowTime.getFullYear(), nowTime.getMonth()+1, nowTime.getDate());
}


/* 
	生成日历
	@year [number] 年
	@month [number] 月
*/
function makeCalendar(year, month, date) {

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
		.parent().prev().find('span').text(year+'年'+month+'月')
	}

	// 摘取有事件有日期标识
	webSQLCommon(`seLECT time fROM calendarDays wHERE time like '${year}-${month > 10 ? month : '0'+month}%'`, [], data => {
		console.log(data);
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
	let YYMM = $('.calendar-control span').text().match(/\d+/g);
	let year = YYMM[0];
	let month= YYMM[1];
	let calendarDays = $('.calendar-days');
	let currentDay = calendarDays.find('.current');
	let day  = parseInt(currentDay.length ? currentDay.text() : calendarDays.find('.day').text());
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

