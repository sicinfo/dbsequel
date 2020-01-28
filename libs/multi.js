/**
 * application
 * 
 * powered by moreira 2019-12-02
 * 
 * copied from https://www.codeproject.com/Articles/1189466/JavaScript-ES-Multiple-Inheritance-Class
 */

module.extends = class multi {
	
	static inherit(..._bases)	{
	  
		class classes {
		  
		  constructor(..._args) {
				let index = 0;
				for (const b of this.base) multi.copy(this, new b(_args[index++]));
			}
			
			get base() { return _bases; }
		}

		for (let base of _bases) {
		  multi.copy(classes, base);
		  multi.copy(classes.prototype, base.prototype);
		}

		return classes;
	}

	static copy(_target, _source) {
	  for (const key of Reflect.ownKeys(_source))
	    key !== "constructor" && 
	    key !== "prototype" && 
	    key !== "name" &&
	    Object.defineProperty(_target, key, Object.getOwnPropertyDescriptor(_source, key));
	}
}