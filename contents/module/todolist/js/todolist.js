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

					goToToday( _id );
				},
				fail => {
					console.error(fail)
				}
			)

			
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

	window.onfocus = ()=>{
		setDate()
	}


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
	  					renameType()
	  				}
	  			},
	  			{
	  				type: 'separator'
	  			},
	  			{
	  				// 删除类型
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

	  		let moveSubMenu = [];
	  		let currentTypeId = document.querySelector('#todo-type-list .current').dataset.id;

	  		let menuArr = [
	  			{
	  				label: '移动',
	  				submenu: moveSubMenu
	  			},
	  			{
	  				type: 'separator'
	  			},
	  			{
			  		// 删除事件
	  				label: '删除',
	  				click() {
	  					delListDom('.todo-list-box', 'todoEvent')
	  				}
	  			}
	  		]

	  		$(e.target).closest('li').addClass('ready').siblings().removeClass('ready');

			webSQLCommon(
				'SELECT * FROM todoType',
				[],
				data => {
					let moveArr = [];
					for (let i = 0, l = data.rows.length; i < l; i++) {

						if (data.rows[i].id > 100) {
							if (data.rows[i].id != currentTypeId) {
								moveSubMenu.push({
									label: data.rows[i].name,
									click() {
										let thisLi = document.querySelector('.todo-list-box .ready');
										moveToOtherType(
											thisLi.dataset, 
											data.rows[i].id, 
											()=> {
												thisLi.remove()
											}
										)
									} 
								})
							}
						}
					}

			  		createMenu( menuArr )
				},
				err => {
					console.error(err)
				}
			)
	  	}
	}, false);


	// 点击日历时间,定位到这今天
	$('.calendar-control span').click(goToToday);


	// 上下月切换日历
	$('button', '.calendar-control').click(function() {
	
		let _ = $('#calendar-days').data();
		let y = _.year;
		let m = _.month;
		let d = _.day;

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

		makeCalendar(y, m, d);
	})

	/*
		日历选择功能
		---------------------------
	*/
	$('#calendar-days').on('click', 'li', function(){
		let _c = 'current';
		let _  = $(this);
		let date   = _.text();
		let $type  = $('.current','#todo-type-list');
		let typeId = $type.length ? $type.data().id : null;

		if (date) {

			_.addClass(_c).siblings().removeClass(_c)

			.parent('#calendar-days').data('day', parseInt(date));
			
			// 移除列表选择
			if (typeId < 2)
				$type.removeClass();
	
			let YYMM = calendarTitleTime();
			let queryTime = calendar.format('YYYY-MM-DD', `${YYMM.year}-${YYMM.month}-${date}`);
			let query = `SELECT * FROM todoEvent WHERE date(remindTime)=date('${queryTime}')`;

			if (typeId > 100) {
				query += ` AND parent in (${typeId})`;
			}

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

		// 对添加功能
		let addBtn = document.getElementById('add-todo-event');
		let _calendarTemp = calendarTitleTime();
		let findTime = _calendarTemp.year ? _calendarTemp.timeStr : calendar.format('YYYY-MM-DD');

		if (addBtn.matches('.clear-search')) addBtn.classList.remove('clear-search');

		let _ = $(this),
			txt = _.find('input').val();
			titleBox = $('.os-day-header'),
			id = this.dataset.id,
			query = `SELECT * FROM todoEvent WHERE parent in (${id}) AND date(remindTime)=date('${findTime}') ORDER BY id DESC`;

		if (id == 2) {
			query = 'SELECT * FROM todoEvent ORDER BY id DESC'
		} else if (id == 1) {
			query = `SELECT * FROM todoEvent WHERE date(remindTime)=date('${calendar.format('YYYY-MM-DD')}') ORDER BY id DESC`
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

		// 更新日历
		setCalendarStatus()

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

		$('ul','.todo-list-box').empty();
		
		// 添加
		let appendLi = function() {
			let titleBox = $('.os-day-header');

			$('<li class="current"><input class="create" type="text"></li>').appendTo(_box);

			// 添加状态
			_box.find('li:last-child').find('input').focus().end()
			.siblings().removeClass();

			// 隐藏日期
			let titleInt = titleBox.find('input');
			if ( titleInt.hasClass('day') ) {
				titleInt.removeClass('day')
			}
			titleBox.find('.inner').hide();
		}

		// 如果没有正在新建,则添加一个
		if (!_current.length) {
			appendLi()
		} 
		// 正在创建时,
		else {
			let __val = _current.val().trim();
			if (__val) {
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

		_.height(32);

		let _H = e.target.scrollHeight;
			
		_.height( _H );
		_inner.removeClass('animate').height( _H + 29);

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

		// 清除搜索功能
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

			// 清除今天没有工作的提醒
			let remindTips = document.querySelector('.no-work-plane');
			
			if (remindTips) {
				remindTips.classList.add('fadeOut');
			}

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


